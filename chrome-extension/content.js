// Content script for Search EHOU Chrome Extension - Simplified Auto Extract Only
class QuestionExtractor {
  constructor() {
    this.isExtracting = false;
    this.autoExtractEnabled = true; // Always enabled for auto extract
    this.autoFillEnabled = true; // Always enabled for auto fill
    this.init();
  }

  init() {
    // Setup message listeners
    this.setupMessageListeners();

    // Load extension state
    this.loadExtensionState();

    // Only keep the auto extract functionality
    this.detectAndAutoExtractReviewPage();
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
      courseName = courseFull;
      courseCode = '';

      // Check if course name contains " - " separator
      if (courseFull.includes(' - ')) {
        const parts = courseFull.split(' - ');
        courseName = parts[0].trim();
        courseCode = parts[1].trim();
      }
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
        // Lấy toàn bộ HTML của div (theo logic jQuery)
        const html = ($d.innerHTML || '').trim();
        if (html) {
          correctAnswersHTML.push(this.cleanAnswer(html));
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
    // Remove answer prefix like "a. ", "b. ", etc.
    return html.replace(/^[a-d]\.\s*/i, '').trim();
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
          // Fill in the answers
          const filledCount = this.fillAnswers(answersFound);

          // Không hiển thị thông báo khi điền thành công (theo yêu cầu)
          // this.showAutoFillNotification(filledCount, quizData.questions.length);
        } else {
          console.log('⚠️ No correct answers found in database');
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
      console.log('🔍 Searching for correct answers...');

      // Prepare questions for bulk search
      const questionsForSearch = quizData.questions.map(q => ({
        questionHTML: q.questionHTML,
        answersHTML: q.answersHTML
      }));

      // Send to background script for API call
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'SEARCH_CORRECT_ANSWERS',
          data: {
            questions: questionsForSearch,
            courseCode: quizData.courseCode
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

        // Fill answer if similarity is high enough (based on confidence)
        const threshold = Math.max(0.7, confidence * 0.9); // Dynamic threshold based on confidence
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
}

// Initialize the question extractor
const questionExtractor = new QuestionExtractor();
console.log('Question extractor initialized successfully - Auto extract only mode');