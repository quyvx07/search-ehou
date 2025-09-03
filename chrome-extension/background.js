// Background script for Search EHOU Chrome Extension - Simplified Auto Extract Only
importScripts('config.js');

let extensionState = {
  isEnabled: true,
  autoExtractEnabled: true,
  autoFillEnabled: true,
  currentCourse: null
};

// Initialize extension state
chrome.runtime.onInstalled.addListener(async () => {
  console.log(CONFIG.MESSAGES.SUCCESS.EXTENSION_LOADED);

  // Load configuration from storage
  await CONFIG.loadFromStorage();

  // Load saved state
  const savedState = await chrome.storage.local.get([CONFIG.STORAGE_KEYS.EXTENSION_STATE]);
  if (savedState[CONFIG.STORAGE_KEYS.EXTENSION_STATE]) {
    extensionState = { ...extensionState, ...savedState[CONFIG.STORAGE_KEYS.EXTENSION_STATE] };
  }

  // Save initial state
  await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.EXTENSION_STATE]: extensionState });
});

// Message handling from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'GET_STATE':
      sendResponse(extensionState);
      break;

    case 'GET_CONFIG':
      sendResponse({ success: true, config: CONFIG });
      break;

    case 'UPDATE_STATE':
      extensionState = { ...extensionState, ...request.data };
      chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.EXTENSION_STATE]: extensionState });
      sendResponse({ success: true });
      break;

    case 'AUTO_EXTRACT_REVIEW_DATA':
      console.log('🔥 AUTO_EXTRACT_REVIEW_DATA received:', {
        courseName: request.data.courseName,
        courseCode: request.data.courseCode,
        questionCount: request.data.questions?.length || 0,
        questions: request.data.questions
      });

      handleAutoExtractReviewData(request.data)
        .then(response => {
          console.log('✅ AUTO_EXTRACT_REVIEW_DATA completed:', response);
          sendResponse({ success: true, ...response });
        })
        .catch(error => {
          console.log('❌ AUTO_EXTRACT_REVIEW_DATA failed:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case 'SEARCH_CORRECT_ANSWERS':
      console.log('🔥 SEARCH_CORRECT_ANSWERS received:', {
        questionCount: request.data.questions?.length || 0,
        courseCode: request.data.courseCode
      });

      handleSearchCorrectAnswers(request.data)
        .then(response => {
          console.log('✅ SEARCH_CORRECT_ANSWERS completed:', response);
          sendResponse({ success: true, ...response });
        })
        .catch(error => {
          console.log('❌ SEARCH_CORRECT_ANSWERS failed:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
      break;
  }
  return true;
});

// Handle auto extract review data
async function handleAutoExtractReviewData(reviewData) {
  try {
    console.log('📦 Processing auto extracted review data:', {
      courseName: reviewData.courseName,
      totalQuestions: reviewData.totalQuestions,
      totalQuestionsFound: reviewData.totalQuestionsFound,
      questionsSkipped: reviewData.questionsSkipped
    });

    // Send to backend API
    const apiResponse = await sendToBackendAPI(reviewData);

    if (apiResponse.success) {
      const message = `Đã gửi ${reviewData.totalQuestions} câu hỏi có đáp án đúng từ môn ${reviewData.courseName} lên server`;
      console.log('✅ Auto extract data sent successfully:', message);
      return {
        message: message,
        data: apiResponse.data
      };
    } else {
      throw new Error(apiResponse.error || 'Failed to send data to backend');
    }

  } catch (error) {
    console.error('❌ Error processing auto extract data:', error);
    throw error;
  }
}

// Send data to backend API
async function sendToBackendAPI(reviewData) {
  try {
    console.log('📤 Sending data to backend:', {
      courseName: reviewData.courseName,
      courseCode: reviewData.courseCode,
      totalQuestions: reviewData.questions.length,
      totalQuestionsFound: reviewData.totalQuestionsFound,
      questionsSkipped: reviewData.questionsSkipped
    });

    // Step 1: Create or get course
    const course = await createOrGetCourse(reviewData);
    if (!course) {
      throw new Error('Failed to create or get course');
    }

    // Step 2: Prepare questions data for bulk upsert
    const questionsForBulk = reviewData.questions.map(question => ({
      courseId: course.id,
      questionHtml: question.questionHTML,
      answersHtml: question.answersHTML,
      correctAnswersHtml: question.correctAnswersHTML,
      explanationHtml: question.explanationHTML || undefined
    }));

    // Step 3: Bulk upsert questions (create new or update existing)
    const questionsResult = await bulkUpsertQuestions(questionsForBulk);

    return {
      success: true,
      data: {
        course: course,
        questionsCreated: questionsResult.length,
        totalQuestionsFound: reviewData.totalQuestionsFound,
        questionsSkipped: reviewData.questionsSkipped,
        message: `Created ${questionsResult.length} questions with correct answers for course ${course.courseName} (skipped ${reviewData.questionsSkipped} questions without correct answers)`
      }
    };

  } catch (error) {
    console.error('❌ API call failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Create or update course using backend upsert
async function createOrGetCourse(reviewData) {
  try {
    const response = await fetch(CONFIG.getApiUrl(CONFIG.URLS.COURSE_UPSERT), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        courseCode: reviewData.courseCode || `EXT_${Date.now()}`,
        courseName: reviewData.courseName
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to upsert course: ${response.status} ${response.statusText}`);
    }

    const course = await response.json();
    console.log('✅ Course upserted:', course);
    return course;

  } catch (error) {
    console.error('❌ Error upserting course:', error);
    throw error;
  }
}



// Bulk upsert questions (create new or update existing)
async function bulkUpsertQuestions(questions) {
  try {
    const response = await fetch(CONFIG.getApiUrl(CONFIG.URLS.QUESTION_BULK_UPSERT), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(questions)
    });

    if (!response.ok) {
      throw new Error(`Bulk upsert failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Bulk upserted questions:', result.length);
    return result;

  } catch (error) {
    console.error('❌ Error bulk upserting questions:', error);
    throw error;
  }
}

// Handle search correct answers
async function handleSearchCorrectAnswers(searchData) {
  try {
    console.log('🔍 Processing search correct answers:', {
      questionCount: searchData.questions?.length || 0,
      courseCode: searchData.courseCode,
      sampleQuestion: searchData.questions && searchData.questions[0] ? {
        questionPreview: searchData.questions[0].questionHTML.substring(0, 100),
        answersCount: searchData.questions[0].answersHTML.length
      } : 'No questions'
    });

    // Send to backend API for bulk search
    const searchResults = await searchQuestionsInBackend(searchData);

    if (searchResults) {
      const message = `Tìm thấy đáp án cho ${searchResults.totalQuestions} câu hỏi`;
      console.log('✅ Search answers completed:', message);
      return {
        message: message,
        data: searchResults
      };
    } else {
      throw new Error('No search results returned from backend');
    }

  } catch (error) {
    console.error('❌ Error searching answers:', error);
    throw error;
  }
}

// Search questions in backend using bulk search API
async function searchQuestionsInBackend(searchData) {
  try {
    console.log('🚀 Searching questions using Hybrid Search (Elasticsearch + Enhanced Keyword):', {
      questionCount: searchData.questions.length,
      courseCode: searchData.courseCode,
      elasticsearchSize: CONFIG.SEARCH.ELASTICSEARCH_SIZE,
      threshold: CONFIG.SEARCH.THRESHOLD
    });

    // Prepare data for bulk search API
    const bulkSearchData = {
      questions: searchData.questions,
      courseCode: searchData.courseCode,
      threshold: CONFIG.SEARCH.THRESHOLD
    };

    // Use regular bulk search for now (hybrid search has issues)
    const url = CONFIG.getFullUrl(CONFIG.URLS.BULK_SEARCH);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bulkSearchData)
    });

    if (!response.ok) {
      throw new Error(`Bulk search failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log(CONFIG.MESSAGES.SUCCESS.SEARCH_COMPLETED, {
      totalQuestions: result.totalQuestions,
      matchedQuestions: result.matchedQuestions,
      averageConfidence: result.averageConfidence,
      processingTimeMs: result.processingTimeMs,
      method: 'Elasticsearch + Enhanced Keyword Matching'
    });

    // DEBUG: Log detailed results
    console.log('🔍 DEBUG: Backend API response details:', {
      totalQuestions: result.totalQuestions,
      matchedQuestions: result.matchedQuestions,
      resultsSummary: result.results ? result.results.map((r, i) => ({
        questionIndex: i,
        hasMatch: r.hasMatch,
        allMatchesCount: r.allMatches ? r.allMatches.length : 0,
        bestMatchScore: r.bestMatch ? r.bestMatch.confidenceScore : 'N/A'
      })) : 'No results'
    });

    return result;

  } catch (error) {
    console.error('❌ Error searching questions in backend:', error);
    throw error;
  }
}

console.log('Background script initialized - Auto extract only mode');