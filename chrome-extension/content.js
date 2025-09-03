// Content script for Search EHOU Chrome Extension - Simplified Auto Extract Only

// Config helper for content scripts
let extensionConfig = null;

async function getExtensionConfig() {
  if (extensionConfig) return extensionConfig;

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'GET_CONFIG' }, (response) => {
      if (response && response.success) {
        extensionConfig = response.config;
        resolve(extensionConfig);
      } else {
        reject(new Error('Failed to get extension config'));
      }
    });
  });
}

// Message listener for content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CONTENT_SCRIPT_READY') {
    sendResponse({ success: true });
  }
});

class QuestionExtractor {
  constructor() {
    this.isExtracting = false;
    this.autoExtractEnabled = true; // Always enabled for auto extract
    this.autoFillEnabled = true; // Always enabled for auto fill
    this.init();
  }

  async init() {
    try {
      // Load extension config first
      const config = await getExtensionConfig();
      console.log(config.MESSAGES.INFO.LOADING, 'Search EHOU Extension');

      // Setup message listeners
      this.setupMessageListeners();

      // Load extension state
      this.loadExtensionState();

      // Only keep the auto extract functionality
      this.detectAndAutoExtractReviewPage();
      
      // Add auto fill button for quiz pages (with delay for DOM loading)
      setTimeout(() => {
        this.addAutoFillButton();
      }, 1000);
    } catch (error) {
      console.error('Failed to initialize extension:', error);
    }
  }

  detectAndAutoExtractReviewPage() {
    // Check if current page is a quiz review page or quiz attempt page
    const pageType = this.detectPageType();

    console.log('🔍 Page detection result:', {
      url: window.location.href,
      pageType,
      autoExtractEnabled: this.autoExtractEnabled,
      autoFillEnabled: this.autoFillEnabled
    });

    if (pageType === 'review' && this.autoExtractEnabled) {
      console.log('🎯 Detected quiz review page, starting auto extraction...');

      // Gửi API ngay lập tức mà không delay
      this.autoExtractReviewData();
    } else if (pageType === 'quiz' && this.autoFillEnabled) {
      console.log('🎯 Detected quiz attempt page, starting auto fill...');

      // Delay to ensure page is fully loaded
      setTimeout(() => {
        this.autoFillQuiz();
      }, 2000); // 2 second delay
    } else if (pageType === 'review' && !this.autoExtractEnabled) {
      console.log('⚠️ Detected quiz review page but auto extract is disabled');
    } else if (pageType === 'quiz' && !this.autoFillEnabled) {
      console.log('⚠️ Detected quiz attempt page but auto fill is disabled');
    } else if (pageType === 'none') {
      console.log('ℹ️ Current page is not a quiz or review page');
    }
  }

  detectPageType() {
    const currentUrl = window.location.href.toLowerCase();

    // Check URL pattern for review pages
    const reviewUrlPatterns = [
      '/mod/quiz/review.php',
      'review.php',
      'review',
      'attempt='
    ];

    // Check URL pattern for quiz attempt pages
    const quizUrlPatterns = [
      '/mod/quiz/attempt.php',
      'attempt.php',
      '/mod/quiz/view.php',
      'view.php'
    ];

    const isReviewUrl = reviewUrlPatterns.some(pattern =>
      currentUrl.includes(pattern)
    );

    const isQuizUrl = quizUrlPatterns.some(pattern =>
      currentUrl.includes(pattern)
    );

    // Check for quiz page elements (questions that can be answered)
    const quizElements = [
      '.que.multichoice input[type="radio"]',
      '.que.multichoice input[type="checkbox"]',
      '.que input[type="text"]',
      '.que textarea',
      'form[action*="attempt"]',
      '.quizattempt'
    ];

    // Check for review page elements (questions that are read-only)
    const reviewElements = [
      '.que.multichoice',
      '.que',
      '.questionflagsaveform',
      '.quizreviewsummary',
      '.coursename',
      '.mod_quiz_review',
      '.path-mod-quiz'
    ];

    const hasQuizElements = quizElements.some(selector =>
      document.querySelector(selector) !== null
    );

    const hasReviewElements = reviewElements.some(selector =>
      document.querySelector(selector) !== null
    );

    // Determine page type based on URL and elements
    if ((isQuizUrl || hasQuizElements) && !isReviewUrl) {
      return 'quiz'; // Quiz attempt page
    } else if (isReviewUrl || hasReviewElements) {
      return 'review'; // Review page
    } else {
      return 'none'; // Not a quiz or review page
    }
  }

  // Keep the old method for backward compatibility
  isReviewPage() {
    return this.detectPageType() === 'review';
  }

  // Setup message listeners for communication with popup and background
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'MANUAL_FILL_QUIZ':
          console.log('🎯 Manual fill quiz requested');
          this.autoFillQuiz();
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
          break;
      }
      return true;
    });
  }

  // Load extension state from background script
  async loadExtensionState() {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'GET_STATE' }, resolve);
      });

      if (response) {
        this.autoExtractEnabled = response.autoExtractEnabled !== undefined ? response.autoExtractEnabled : true;
        this.autoFillEnabled = response.autoFillEnabled !== undefined ? response.autoFillEnabled : true;

        console.log('🔄 Extension state loaded:', {
          autoExtractEnabled: this.autoExtractEnabled,
          autoFillEnabled: this.autoFillEnabled
        });
      }
    } catch (error) {
      console.error('❌ Error loading extension state:', error);
    }
  }

  async autoExtractReviewData() {
    if (this.isExtracting) {
      console.log('⚠️ Already extracting, skipping auto extraction');
      return;
    }

    try {
      console.log('🔄 Starting auto extraction of review data...');

      // Extract review data
      const reviewData = await this.extractReviewData();

      if (reviewData && reviewData.questions.length > 0) {
        console.log('✅ Auto extracted review data:', reviewData);

        // Send to background script for processing
        chrome.runtime.sendMessage({
          action: 'AUTO_EXTRACT_REVIEW_DATA',
          data: reviewData
        }, (response) => {
          if (response && response.success) {
            console.log('✅ Review data sent to background:', response.message);
          } else {
            console.error('❌ Failed to send review data to background:', response?.error);
          }
        });
      } else {
        console.log('⚠️ No review data found to extract');
      }

    } catch (error) {
      console.error('❌ Auto extraction failed:', error);
    }
  }

  async extractReviewData() {
    console.log('📋 Extracting review data from page...');

    try {
      this.isExtracting = true;

      // Get course information
      const courseInfo = this.extractCourseInfo();
      const questions = [];
      let totalQuestionsFound = 0;
      let questionsSkipped = 0;

      // Extract questions from review page
      const questionElements = document.querySelectorAll('.que.multichoice, .que');

      for (let i = 0; i < questionElements.length; i++) {
        const questionElement = questionElements[i];
        const questionData = this.extractQuestionData(questionElement, i + 1);

        totalQuestionsFound++;

        if (questionData) {
          questions.push(questionData);
        } else {
          questionsSkipped++;
        }
      }

      // Create review data object
      const reviewData = {
        ...courseInfo,
        questions: questions,
        totalQuestions: questions.length,
        totalQuestionsFound: totalQuestionsFound,
        questionsSkipped: questionsSkipped,
        extractedAt: new Date().toISOString(),
        pageUrl: window.location.href
      };

      console.log('📊 Review data summary:', {
        courseName: reviewData.courseName,
        courseCode: reviewData.courseCode,
        totalQuestionsFound: reviewData.totalQuestionsFound,
        validQuestions: reviewData.totalQuestions,
        questionsSkipped: reviewData.questionsSkipped
      });

      this.isExtracting = false;
      return reviewData;

    } catch (error) {
      console.error('❌ Error extracting review data:', error);
      this.isExtracting = false;
      throw error;
    }
  }

  extractCourseInfo() {
    // Extract course name from page using jQuery-like selectors
    let courseName = '';
    let courseCode = '';

    // Try the specific selector from user's code
    const courseElement = document.querySelector('.coursename h2 a') ||
                         document.querySelector('.coursename a') ||
                         document.querySelector('.coursename');

    if (courseElement) {
      const courseFull = courseElement.textContent.trim();
      console.log('🔍 DEBUG: Course extraction - Full text:', courseFull);
      courseName = courseFull;
      courseCode = '';

      // Check if course name contains " - " separator
      if (courseFull.includes(' - ')) {
        const parts = courseFull.split(' - ');
        courseName = parts[0].trim();
        courseCode = parts[1].trim();
        console.log('🔍 DEBUG: Course extraction - Split result:', {
          courseName: courseName,
          courseCode: courseCode,
          originalParts: parts
        });
      } else {
        console.log('🔍 DEBUG: Course extraction - No separator found, using full text as name');
      }
    }

    // Normalize courseCode - remove part after dot (e.g., "IT02.059" -> "IT02")
    if (courseCode && courseCode.includes('.')) {
      const normalizedCode = courseCode.split('.')[0];
      console.log('🔍 DEBUG: Course code normalized:', {
        original: courseCode,
        normalized: normalizedCode
      });
      courseCode = normalizedCode;
    }

    return {
      courseName: courseName || 'Unknown Course',
      courseCode: courseCode || 'N/A'
    };
  }

  extractQuestionData(questionElement, questionNumber) {
    try {
      // Extract question HTML
      const questionHTML = this.extractQuestionHTML(questionElement);
      if (!questionHTML) {
        return null;
      }

      // Extract answers HTML
      const answersHTML = this.extractAnswersHTML(questionElement);
      if (!answersHTML || answersHTML.length === 0) {
        console.log('⚠️ Skipping question without answers');
        return null;
      }

      // Extract correct answers HTML
      const correctAnswersHTML = this.extractCorrectAnswersHTML(questionElement);

      if (!correctAnswersHTML || correctAnswersHTML.length === 0) {
        return null;
      }

      // Extract explanation HTML
      const explanationHTML = this.extractExplanationHTML(questionElement);


      return {
        questionHTML,
        answersHTML,
        correctAnswersHTML,
        explanationHTML,
      };

    } catch (error) {
      console.error('❌ Error extracting question data:', error);
      return null;
    }
  }

  extractQuestionHTML(questionElement) {
    // Extract question HTML from .qtext element
    const qtextElement = questionElement.querySelector('.qtext');
    if (qtextElement) {
      return (qtextElement.innerHTML || '').trim();
    }
    return '';
  }

  extractAnswersHTML(questionElement) {
    const answersHTML = [];

    // Extract answers from .answer > div label elements
    const answerLabels = questionElement.querySelectorAll('.answer > div label');

    answerLabels.forEach(label => {
      const html = (label.innerHTML || '').trim();
      if (html) {
        answersHTML.push(this.cleanAnswer(html));
      }
    });

    return answersHTML;
  }

  extractCorrectAnswersHTML(questionElement) {
    const correctAnswersHTML = [];

    // Tìm tất cả đáp án đúng theo logic jQuery
    const answerDivs = questionElement.querySelectorAll('.answer > div');
    answerDivs.forEach(div => {
      const $d = div; // Using div element directly

      // Check if this div has correct indicators (theo logic jQuery)
      const hasCorrectClass = $d.classList.contains('correct');
      const hasCorrectImg = $d.querySelector('img[alt="Câu trả lời đúng"], img[alt="Correct answer"]') !== null;

      if (hasCorrectClass || hasCorrectImg) {
        // Lấy nội dung từ thẻ label và loại bỏ prefix
        const label = $d.querySelector('label');
        if (label) {
          const labelHtml = (label.innerHTML || '').trim();
          if (labelHtml) {
            correctAnswersHTML.push(this.cleanAnswer(labelHtml));
          }
        } else {
          // Fallback: Lấy toàn bộ HTML của div nếu không tìm thấy label
          const html = ($d.innerHTML || '').trim();
          if (html) {
            correctAnswersHTML.push(this.cleanAnswer(html));
          }
        }
      }
    });

    return correctAnswersHTML;
  }

  extractExplanationHTML(questionElement) {
    // Extract explanation from .specificfeedback element
    const feedbackElement = questionElement.querySelector('.specificfeedback');
    if (feedbackElement) {
      return (feedbackElement.innerHTML || '').trim();
    }
    return '';
  }

  cleanAnswer(html) {
    // Remove answer prefix like "a. ", "b. ", etc. from text content
    // But preserve HTML structure if present
    let cleaned = html;

    // If it's plain text, just remove prefix
    if (!/<[^>]*>/.test(html)) {
      return html.replace(/^[a-d]\.\s*/i, '').trim();
    }

    // If it contains HTML, try to clean the text content
    // Create a temporary element to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Get text content and remove prefix
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    const cleanedText = textContent.replace(/^[a-d]\.\s*/i, '').trim();

    // If text content changed, reconstruct HTML with cleaned text
    if (textContent !== cleanedText) {
      // Find the main text node or element containing the answer text
      const textNodes = [];
      const walk = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while (node = walk.nextNode()) {
        if (node.textContent && node.textContent.trim()) {
          textNodes.push(node);
        }
      }

      // Replace the first text node that contains the answer prefix
      if (textNodes.length > 0) {
        const firstTextNode = textNodes[0];
        const originalText = firstTextNode.textContent || '';
        const cleanedNodeText = originalText.replace(/^[a-d]\.\s*/i, '').trim();
        firstTextNode.textContent = cleanedNodeText;
        cleaned = tempDiv.innerHTML;
      }
    }

    return cleaned.trim();
  }

  showAutoExtractNotification(reviewData, message) {
    // Remove existing notification if any
    const existing = document.getElementById('ehou-auto-extract-notification');
    if (existing) {
      existing.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'ehou-auto-extract-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      max-width: 320px;
      cursor: pointer;
    `;

    const skippedInfo = reviewData.questionsSkipped > 0
      ? `<br>Bỏ qua: ${reviewData.questionsSkipped} câu (không có đáp án đúng)`
      : '';

    notification.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px;">✅ Auto Extract Complete</div>
      <div style="margin-bottom: 5px;">${message}</div>
      <div style="font-size: 12px; opacity: 0.9;">
        Môn học: ${reviewData.courseName}<br>
        Câu hỏi hợp lệ: ${reviewData.totalQuestions}/${reviewData.totalQuestionsFound}${skippedInfo}
      </div>
    `;

    // Add close functionality
    notification.onclick = () => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    };

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);

    document.body.appendChild(notification);
  }

  cleanText(text) {
    if (!text) return '';
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\u00A0\u2007\u202F]/g, ' ')
      .trim();
  }

  // Auto fill quiz with correct answers
  async autoFillQuiz() {
    if (this.isExtracting) {
      console.log('⚠️ Already extracting, skipping auto fill');
      return;
    }

    try {
      console.log('🔄 Starting auto fill of quiz answers...');

      // Extract quiz questions from current page
      const quizData = await this.extractQuizQuestions();

      if (quizData && quizData.questions.length > 0) {
        console.log('✅ Extracted quiz questions:', quizData);

        // Search for correct answers in backend
        const answersFound = await this.searchCorrectAnswers(quizData);

        if (answersFound && answersFound.length > 0) {
          console.log('✅ DEBUG: Found answers for questions:', answersFound.map(a => ({
            questionIndex: a.questionIndex + 1,
            matchScore: a.matchScore,
            confidence: a.confidence,
            correctAnswersCount: a.correctAnswers.length
          })));

          // Fill in the answers
          const filledCount = this.fillAnswers(answersFound);

          console.log('✅ DEBUG: Fill results:', {
            answersFound: answersFound.length,
            filledCount: filledCount,
            totalQuestions: quizData.questions.length,
            successRate: `${((filledCount / quizData.questions.length) * 100).toFixed(1)}%`
          });

          // Không hiển thị thông báo khi điền thành công (theo yêu cầu)
          // this.showAutoFillNotification(filledCount, quizData.questions.length);
        } else {
          console.log('⚠️ No correct answers found in database - All questions had low confidence or no matches');
          // Không hiển thị thông báo khi không tìm thấy đáp án (theo yêu cầu)
          // this.showAutoFillNotification(0, quizData.questions.length);
        }
      } else {
        console.log('⚠️ No quiz questions found to fill');
      }

    } catch (error) {
      console.error('❌ Auto fill failed:', error);
    }
  }

  // Extract quiz questions from current page
  async extractQuizQuestions() {
    console.log('📋 Extracting quiz questions from page...');

    try {
      this.isExtracting = true;

      // Get course information
      const courseInfo = this.extractCourseInfo();
      const questions = [];

      // Extract questions from quiz page
      const questionElements = document.querySelectorAll('.que.multichoice, .que');

      for (let i = 0; i < questionElements.length; i++) {
        const questionElement = questionElements[i];
        const questionData = this.extractQuizQuestionData(questionElement, i + 1);

        if (questionData) {
          questions.push(questionData);
        }
      }

      // Create quiz data object
      const quizData = {
        ...courseInfo,
        questions: questions,
        totalQuestions: questions.length,
        extractedAt: new Date().toISOString(),
        pageUrl: window.location.href
      };

      console.log('📊 Quiz data summary:', {
        courseName: quizData.courseName,
        courseCode: quizData.courseCode,
        totalQuestions: quizData.totalQuestions
      });

      this.isExtracting = false;
      return quizData;

    } catch (error) {
      console.error('❌ Error extracting quiz questions:', error);
      this.isExtracting = false;
      throw error;
    }
  }

  // Extract question data from quiz page (without correct answers)
  extractQuizQuestionData(questionElement, questionNumber) {
    try {
      // Extract question HTML
      const questionHTML = this.extractQuestionHTML(questionElement);
      if (!questionHTML) {
        console.log('⚠️ Skipping question without text');
        return null;
      }

      // Extract answers HTML
      const answersHTML = this.extractAnswersHTML(questionElement);
      if (!answersHTML || answersHTML.length === 0) {
        console.log('⚠️ Skipping question without answers');
        return null;
      }

      return {
        questionHTML,
        answersHTML,
        questionElement, // Keep reference to DOM element for filling
        questionNumber
      };

    } catch (error) {
      console.error('❌ Error extracting quiz question data:', error);
      return null;
    }
  }

  // Search for correct answers in backend
  async searchCorrectAnswers(quizData) {
    try {
      const config = await getExtensionConfig();
      console.log(config.MESSAGES.INFO.SEARCHING, 'using Hybrid Search (Elasticsearch + Enhanced Keyword Matching)');

      // Prepare questions for hybrid search (including both questions and answers)
      const questionsForSearch = quizData.questions.map(q => ({
        questionHTML: q.questionHTML,
        answersHTML: q.answersHTML
      }));

      console.log('🔍 DEBUG: Questions prepared for search:', {
        totalQuestions: questionsForSearch.length,
        courseCode: quizData.courseCode,
        sampleQuestion: questionsForSearch[0], // Log câu hỏi đầu tiên để debug
        allQuestions: questionsForSearch.map((q, i) => ({
          index: i,
          questionPreview: q.questionHTML.substring(0, 100) + '...',
          answerCount: q.answersHTML.length
        }))
      });

      // Use original courseCode - backend now handles wildcard search
      // Example: IT02.059 will find IT02, IT02.059, IT02.023, etc.
      const courseCode = quizData.courseCode;
      console.log('🔍 DEBUG: Using courseCode for wildcard search:', courseCode);

      // Send to background script for API call
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'SEARCH_CORRECT_ANSWERS',
          data: {
            questions: questionsForSearch,
            courseCode: courseCode
          }
        }, (response) => {
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(response?.error || 'Failed to search answers');
          }
        });
      });

      console.log('✅ Search results:', response);

      // DEBUG: Log detailed results for each question
      if (response && response.results) {
        console.log('🔍 DEBUG: Detailed search results for each question:');
        response.results.forEach((result, index) => {
          console.log(`Question ${index + 1}:`, {
            hasMatch: result.hasMatch,
            allMatchesCount: result.allMatches ? result.allMatches.length : 0,
            bestMatchScore: result.bestMatch ? result.bestMatch.confidenceScore : 'N/A',
            originalQuestionPreview: result.originalQuestion ? result.originalQuestion.substring(0, 100) : 'N/A'
          });

          if (result.allMatches && result.allMatches.length > 0) {
            console.log(`  └─ All matches for question ${index + 1}:`, result.allMatches.map(match => ({
              confidenceScore: match.confidenceScore,
              matchScore: match.matchScore,
              questionPreview: match.questionHtml ? match.questionHtml.substring(0, 50) : 'N/A'
            })));
          }
        });
      }

      // Process results and match with quiz questions using improved algorithm
      const answersFound = [];
      if (response && response.results) {
        response.results.forEach((result, index) => {
          if (result.hasMatch && result.bestMatch) {
            // Extract current question's answer texts for better matching
            const currentQuestion = quizData.questions[index];
            const currentAnswerTexts = this.extractAnswerTexts(currentQuestion);

            // Find best match using improved algorithm
            const bestMatch = this.findBestMatch(currentQuestion, result.allMatches || [result.bestMatch]);

            console.log(`🔍 DEBUG: Best match for question ${index + 1}:`, {
              found: bestMatch ? true : false,
              matchScore: bestMatch ? bestMatch.matchScore : 'N/A',
              confidenceScore: bestMatch ? bestMatch.confidenceScore : 'N/A',
              threshold: 0.6,
              willUse: bestMatch && (bestMatch.matchScore >= 0.6) ? true : false,
              correctAnswersCount: bestMatch ? bestMatch.correctAnswersHtml.length : 0
            });

            if (bestMatch) {
              answersFound.push({
                questionIndex: index,
                questionElement: currentQuestion.questionElement,
                correctAnswers: bestMatch.correctAnswersHtml,
                explanation: bestMatch.explanationHtml,
                confidence: bestMatch.confidenceScore,
                matchScore: bestMatch.matchScore
              });
            }
          }
        });
      }

      return answersFound;

    } catch (error) {
      console.error('❌ Error searching correct answers:', error);
      throw error;
    }
  }

  // Fill answers into quiz form
  fillAnswers(answersFound) {
    let filledCount = 0;

    answersFound.forEach(answer => {
      try {
        const questionElement = answer.questionElement;
        const correctAnswers = answer.correctAnswers;
        const matchScore = answer.matchScore || answer.confidence || 0;

        // Only fill if confidence is high enough
        if (matchScore >= 0.6) {
          if (this.fillSingleQuestion(questionElement, correctAnswers, matchScore)) {
            filledCount++;
            console.log(`✅ Filled answer for question ${answer.questionIndex + 1} (confidence: ${(matchScore * 100).toFixed(1)}%)`);
          } else {
            console.log(`⚠️ Could not fill answer for question ${answer.questionIndex + 1}`);
          }
        } else {
          console.log(`⚠️ Skipped question ${answer.questionIndex + 1} - low confidence (${(matchScore * 100).toFixed(1)}%)`);
        }
      } catch (error) {
        console.error('❌ Error filling answer:', error);
      }
    });

    return filledCount;
  }

  // Fill a single question's answers
  fillSingleQuestion(questionElement, correctAnswers, confidence = 1.0) {
    if (!correctAnswers || correctAnswers.length === 0) {
      return false;
    }

    try {
      // Get all answer inputs (radio buttons, checkboxes)
      const answerInputs = questionElement.querySelectorAll('input[type="radio"], input[type="checkbox"]');

      if (answerInputs.length === 0) {
        return false; // No inputs found
      }

      // Get answer labels
      const answerLabels = questionElement.querySelectorAll('.answer label');

      let answersFilled = 0;

      correctAnswers.forEach(correctAnswer => {
        // Clean the correct answer text
        const cleanCorrectAnswer = this.cleanText(this.stripHtml(correctAnswer));

        // Find best matching answer input
        let bestMatch = null;
        let bestSimilarity = 0;

        for (let i = 0; i < answerLabels.length; i++) {
          const label = answerLabels[i];
          const input = label.querySelector('input[type="radio"], input[type="checkbox"]') ||
                       answerInputs[i];

          if (input && !input.checked) { // Don't override already checked answers
            const labelText = this.cleanText(this.stripHtml(label.innerHTML));

            // Calculate similarity score
            const similarity = this.calculateTextSimilarity(labelText, cleanCorrectAnswer);

            if (similarity > bestSimilarity) {
              bestSimilarity = similarity;
              bestMatch = { input, similarity };
            }
          }
        }

        // Fill answer if similarity is high enough (minimum 50%)
        const threshold = 0.5; // Fixed 50% threshold - no exceptions
        if (bestMatch && bestSimilarity >= threshold) {
          // Check the input
          bestMatch.input.checked = true;

          // Trigger change event to notify the page
          bestMatch.input.dispatchEvent(new Event('change', { bubbles: true }));

          answersFilled++;
          console.log(`  └─ Matched answer with ${(bestSimilarity * 100).toFixed(1)}% similarity`);
        } else {
          console.log(`  └─ No good match found for answer (best: ${(bestSimilarity * 100).toFixed(1)}%)`);
        }
      });

      return answersFilled > 0;

    } catch (error) {
      console.error('❌ Error filling single question:', error);
      return false;
    }
  }

  // Check if answer text matches
  isAnswerMatch(labelText, correctAnswerText) {
    // Remove common prefixes and clean text
    const cleanLabel = labelText.replace(/^[a-d]\)\s*/i, '').replace(/^[a-d]\.\s*/i, '');
    const cleanCorrect = correctAnswerText.replace(/^[a-d]\)\s*/i, '').replace(/^[a-d]\.\s*/i, '');

    // Exact match
    if (cleanLabel.toLowerCase().includes(cleanCorrect.toLowerCase()) ||
        cleanCorrect.toLowerCase().includes(cleanLabel.toLowerCase())) {
      return true;
    }

    // Fuzzy match - check if significant words overlap
    const labelWords = cleanLabel.toLowerCase().split(/\s+/);
    const correctWords = cleanCorrect.toLowerCase().split(/\s+/);

    const commonWords = labelWords.filter(word =>
      word.length > 2 && correctWords.includes(word)
    );

    return commonWords.length >= Math.min(2, Math.min(labelWords.length, correctWords.length));
  }

  // Strip HTML tags from text
  stripHtml(html) {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }

  // Generate multiple courseCode variants for better matching
  generateCourseCodeVariants(originalCode) {
    if (!originalCode) return [''];

    const variants = new Set();
    variants.add(originalCode); // Original code

    // Remove parts after dot (IT02.059 -> IT02)
    if (originalCode.includes('.')) {
      const baseCode = originalCode.split('.')[0];
      variants.add(baseCode);
    }

    // Remove parts after dash (IT02-001 -> IT02)
    if (originalCode.includes('-')) {
      const baseCode = originalCode.split('-')[0];
      variants.add(baseCode);
    }

    // Remove parts after underscore (IT02_001 -> IT02)
    if (originalCode.includes('_')) {
      const baseCode = originalCode.split('_')[0];
      variants.add(baseCode);
    }

    // Remove numbers at the end (IT02123 -> IT02)
    const withoutNumbers = originalCode.replace(/\d+$/, '');
    if (withoutNumbers !== originalCode && withoutNumbers.length > 0) {
      variants.add(withoutNumbers);
    }

    // Convert to uppercase
    variants.add(originalCode.toUpperCase());

    // Remove spaces and special characters
    const cleanCode = originalCode.replace(/[^a-zA-Z0-9]/g, '');
    if (cleanCode !== originalCode) {
      variants.add(cleanCode);
    }

    // Common patterns: IT02, CS01, etc.
    const letterNumberPattern = originalCode.match(/^([A-Za-z]+)(\d+)(.*)$/);
    if (letterNumberPattern) {
      const [_, letters, numbers] = letterNumberPattern;
      variants.add(letters + numbers); // IT02
      variants.add(letters.toUpperCase() + numbers); // IT02

      // Also try with just 2 digits (IT02123 -> IT02)
      if (numbers.length > 2) {
        variants.add(letters + numbers.substring(0, 2));
        variants.add(letters.toUpperCase() + numbers.substring(0, 2));
      }
    }

    // Handle year patterns (IT02.2023 -> IT02)
    const yearPattern = originalCode.match(/^([A-Za-z]+\d+)\.(\d{4})$/);
    if (yearPattern) {
      variants.add(yearPattern[1]); // IT02
    }

    // Handle semester patterns (IT02.1 -> IT02)
    const semesterPattern = originalCode.match(/^([A-Za-z]+\d+)\.(\d)$/);
    if (semesterPattern) {
      variants.add(semesterPattern[1]); // IT02
    }

    // Common Vietnamese university course codes
    const commonPrefixes = ['IT', 'CS', 'SE', 'IS', 'CE', 'EE', 'ME', 'BE', 'CH', 'PH', 'MA', 'EN', 'HI', 'GE'];
    for (const prefix of commonPrefixes) {
      if (originalCode.toUpperCase().startsWith(prefix)) {
        // Extract number part
        const numberMatch = originalCode.match(new RegExp(`^${prefix}(\\d+)`));
        if (numberMatch) {
          variants.add(prefix + numberMatch[1]);
          variants.add(prefix.toLowerCase() + numberMatch[1]);
        }
      }
    }

    // Return unique variants as array, prioritize shorter codes first
    return Array.from(variants).filter(code => code.length > 0).sort((a, b) => a.length - b.length);
  }

  // Extract answer texts from current question for better matching
  extractAnswerTexts(questionData) {
    if (!questionData || !questionData.answersHTML) {
      return [];
    }

    return questionData.answersHTML.map(answerHtml => {
      const cleanText = this.stripHtml(answerHtml);
      return this.cleanText(cleanText).replace(/^[a-d]\)\s*/i, '').replace(/^[a-d]\.\s*/i, '');
    }).filter(text => text.length > 0);
  }

  // Find best match using improved algorithm
  findBestMatch(currentQuestion, databaseMatches) {
    if (!databaseMatches || databaseMatches.length === 0) {
      return null;
    }

    // Extract current question components
    const currentQuestionText = this.cleanText(this.stripHtml(currentQuestion.questionHTML));
    const currentAnswerTexts = this.extractAnswerTexts(currentQuestion);

    let bestMatch = null;
    let bestScore = 0;

    for (const dbMatch of databaseMatches) {
      const matchScore = this.calculateMatchScore(currentQuestionText, currentAnswerTexts, dbMatch);

      if (matchScore > bestScore) {
        bestScore = matchScore;
        bestMatch = {
          ...dbMatch,
          matchScore: matchScore
        };
      }
    }

    // Only return match if score is above threshold
    return bestScore >= 0.6 ? bestMatch : null;
  }

  // Calculate comprehensive match score
  calculateMatchScore(currentQuestionText, currentAnswerTexts, dbMatch) {
    let totalScore = 0;
    let factors = 0;

    // Factor 1: Question text similarity (40% weight)
    const questionSimilarity = this.calculateTextSimilarity(currentQuestionText, this.stripHtml(dbMatch.questionHtml));
    totalScore += questionSimilarity * 0.4;
    factors += 0.4;

    // Factor 2: Answer set similarity (60% weight)
    if (currentAnswerTexts.length > 0 && dbMatch.answersHtml) {
      const answerSimilarity = this.calculateAnswerSetSimilarity(currentAnswerTexts, dbMatch.answersHtml);
      totalScore += answerSimilarity * 0.6;
      factors += 0.6;
    }

    // Factor 3: Database confidence score (bonus)
    if (dbMatch.confidenceScore) {
      totalScore += dbMatch.confidenceScore * 0.1;
      factors += 0.1;
    }

    return factors > 0 ? totalScore / factors : 0;
  }

  // Calculate text similarity using improved algorithm
  calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;

    const clean1 = this.cleanText(text1).toLowerCase();
    const clean2 = this.cleanText(text2).toLowerCase();

    if (clean1 === clean2) return 1.0;

    // Check if one contains the other
    if (clean1.includes(clean2) || clean2.includes(clean1)) {
      return 0.9;
    }

    // Calculate word-based similarity
    const words1 = clean1.split(/\s+/).filter(word => word.length > 2);
    const words2 = clean2.split(/\s+/).filter(word => word.length > 2);

    if (words1.length === 0 || words2.length === 0) return 0;

    const commonWords = words1.filter(word => words2.includes(word));
    const similarity = commonWords.length / Math.max(words1.length, words2.length);

    return Math.min(similarity, 0.8); // Cap at 80% for word-based matching
  }

  // Calculate answer set similarity
  calculateAnswerSetSimilarity(currentAnswers, dbAnswers) {
    if (!currentAnswers || !dbAnswers || currentAnswers.length === 0 || dbAnswers.length === 0) {
      return 0;
    }

    const dbAnswerTexts = dbAnswers.map(answer => {
      const cleanText = this.stripHtml(answer);
      return this.cleanText(cleanText).replace(/^[a-d]\)\s*/i, '').replace(/^[a-d]\.\s*/i, '');
    }).filter(text => text.length > 0);

    if (dbAnswerTexts.length === 0) return 0;

    // Calculate similarity between answer sets
    let totalSimilarity = 0;
    let comparisons = 0;

    for (const currentAnswer of currentAnswers) {
      let bestSimilarity = 0;

      for (const dbAnswer of dbAnswerTexts) {
        const similarity = this.calculateTextSimilarity(currentAnswer, dbAnswer);
        bestSimilarity = Math.max(bestSimilarity, similarity);
      }

      totalSimilarity += bestSimilarity;
      comparisons++;
    }

    // Also compare in reverse direction
    for (const dbAnswer of dbAnswerTexts) {
      let bestSimilarity = 0;

      for (const currentAnswer of currentAnswers) {
        const similarity = this.calculateTextSimilarity(dbAnswer, currentAnswer);
        bestSimilarity = Math.max(bestSimilarity, similarity);
      }

      totalSimilarity += bestSimilarity;
      comparisons++;
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  // Show auto fill notification
  showAutoFillNotification(filledCount, totalCount) {
    // Remove existing notification if any
    const existing = document.getElementById('ehou-auto-fill-notification');
    if (existing) {
      existing.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'ehou-auto-fill-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${filledCount > 0 ? '#4CAF50' : '#FF9800'};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      max-width: 300px;
      cursor: pointer;
    `;

    const message = filledCount > 0
      ? `✅ Tự động điền thành công ${filledCount}/${totalCount} câu hỏi`
      : `⚠️ Không tìm thấy đáp án cho ${totalCount} câu hỏi trong cơ sở dữ liệu`;

    notification.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px;">Tự động điền câu trả lời</div>
      <div style="margin-bottom: 5px;">${message}</div>
      <div style="font-size: 12px; opacity: 0.9;">
        Nhấp để đóng
      </div>
    `;

    // Add close functionality
    notification.onclick = () => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    };

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);

    document.body.appendChild(notification);
  }

  // Add auto fill button for quiz pages
  addAutoFillButton() {
    // Only add button on quiz attempt pages
    const isQuizPage = window.location.href.includes('/mod/quiz/attempt.php');
    if (!isQuizPage) return;

    // Check if button already exists
    if (document.getElementById('ehou-auto-fill-btn')) return;

    // Try to find the specific container first
    let targetContainer = document.querySelector('#mCSB_2_container .tab-content');
    
    // If not found, try alternative selectors
    if (!targetContainer) {
      targetContainer = document.querySelector('.tab-content');
    }
    
    // If still not found, fallback to quiz navigation area
    if (!targetContainer) {
      targetContainer = document.querySelector('#mod_quiz_navblock .content');
    }
    
    // Last fallback to document body
    if (!targetContainer) {
      targetContainer = document.body;
    }

    // Create auto fill button container
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'ehou-auto-fill-container';
    buttonContainer.style.cssText = `
      margin: 10px 0;
      padding: 10px;
      border-radius: 8px;
      background: rgba(102, 126, 234, 0.1);
      border: 1px solid rgba(102, 126, 234, 0.3);
    `;

    // Create auto fill button
    const autoFillBtn = document.createElement('button');
    autoFillBtn.id = 'ehou-auto-fill-btn';
    autoFillBtn.innerHTML = '🤖 Auto làm bài';
    autoFillBtn.style.cssText = `
      width: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      transition: all 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Hover effects
    autoFillBtn.addEventListener('mouseenter', () => {
      autoFillBtn.style.transform = 'translateY(-1px)';
      autoFillBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
    });

    autoFillBtn.addEventListener('mouseleave', () => {
      autoFillBtn.style.transform = 'translateY(0)';
      autoFillBtn.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    });

    // Click handler
    autoFillBtn.addEventListener('click', async () => {
      try {
        autoFillBtn.disabled = true;
        autoFillBtn.innerHTML = '🔄 Đang làm bài...';
        autoFillBtn.style.background = '#6c757d';
        
        await this.autoFillQuiz();
        
        autoFillBtn.innerHTML = '✅ Hoàn thành!';
        autoFillBtn.style.background = '#28a745';
        
        setTimeout(() => {
          autoFillBtn.disabled = false;
          autoFillBtn.innerHTML = '🤖 Auto làm bài';
          autoFillBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }, 3000);
        
      } catch (error) {
        console.error('❌ Auto fill error:', error);
        autoFillBtn.innerHTML = '❌ Lỗi';
        autoFillBtn.style.background = '#dc3545';
        
        setTimeout(() => {
          autoFillBtn.disabled = false;
          autoFillBtn.innerHTML = '🤖 Auto làm bài';
          autoFillBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }, 3000);
      }
    });

    // Add description text
    const description = document.createElement('p');
    description.innerHTML = '📝 Tự động tìm và điền đáp án đúng cho tất cả câu hỏi';
    description.style.cssText = `
      margin: 8px 0 0 0;
      font-size: 12px;
      color: #666;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Assemble container
    buttonContainer.appendChild(autoFillBtn);
    buttonContainer.appendChild(description);

    // Add to target container
    if (targetContainer === document.body) {
      // For body, use fixed positioning
      buttonContainer.style.cssText += `
        position: fixed;
        top: 120px;
        right: 20px;
        z-index: 10000;
        width: 200px;
      `;
    } else {
      // For specific containers, use relative positioning
      targetContainer.insertBefore(buttonContainer, targetContainer.firstChild);
    }
    
    if (targetContainer === document.body) {
      targetContainer.appendChild(buttonContainer);
    }
    
    console.log('✅ Auto fill button added to quiz page in container:', targetContainer.className || targetContainer.tagName);
  }
}

// Initialize the question extractor
const questionExtractor = new QuestionExtractor();
console.log('Question extractor initialized successfully - Auto extract only mode');