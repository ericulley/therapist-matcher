// App Constants
const API_GATEWAY_KEY = "3239dafe68ecdfda0059990940cd669d6b27b6fa60c2f094d44988f13ddfee9c";
const API_GATEWAY_URL = "https://81bnq1ing6.execute-api.us-west-2.amazonaws.com/prod/matcher";

// Success Message Template
const successMessage = (recommendation) => {
  return `<div class="recommendation-card">
        <h3>Your Therapist Match</h3>
        <div class="therapist-info">
        <h4>${recommendation.therapistName}</h4>
        <div class="match-score">Match Score: ${recommendation.matchScore}%</div>
        </div>
        
        <div class="reasoning-section">
        <h5>Why This Match?</h5>
        <p>${recommendation.reasoning}</p>
        </div>
        
        <div class="next-steps-section">
        <h5>Next Steps</h5>
        <ul>
            <li>Learn more about ${recommendation.therapistName} by reading their full <a href="${recommendation.therapistProfile}">therapist profile</a>.</li>
            <li>Email <a href=mailto:"${recommendation.therapistEmail}">${recommendation.therapistEmail}</a> to confirm session availability.</li>
            <li>Contact our office at ${recommendation.therapistPhone} to schedule an initial intake appointment.</li>
        </ul>
        </div>
    </div>
`;
};

// Apline Data Handlers
document.addEventListener("alpine:init", () => {
  Alpine.data("matcher", () => {
    return {
      // Site Properties and Functions
      page: 0,
      nextPage() {
        if (this.page < 7) this.page++;
        window.scroll({
          top: 0,
          left: 0,
          behavior: "smooth",
        });
      },
      prevPage() {
        if (this.page > 1) this.page--;
        window.scroll({
          top: 0,
          left: 0,
          behavior: "smooth",
        });
      },

      // Form Properties and Functions
      form: {
        name: "",
        email: "",
        phone: "",
        location: "",
        primaryConcerns: {
          anxiety: false,
          depression: false,
          relationshipIssues: false,
          stressManagement: false,
          trauma: false,
          griefLoss: false,
          selfEsteem: false,
          other: false,
        },
        personalityTraits: {
          knowledgeable: false,
          gentle: false,
          affirming: false,
          direct: false,
          structured: false,
          unstructured: false,
          practical: false,
          spiritual: false,
          cerebral: false,
          warm: false,
          funny: false,
        },
        distressLevel: 5,
        previousTherapy: "",
        therapyApproach: "",
        sessionType: "",
        comments: "",
      },
      validateInputs(pageNumber) {
        if (pageNumber === 0) {
        }
        if (pageNumber === 1) {
        }
      },
      async submitQuestionaire(event) {
        // URL format: https://{API_ID}.execute-api.us-west-2.amazonaws.com/prod/questionnaire
        const apiUrl = API_GATEWAY_URL;
        const responseDiv = document.getElementById("response-message");
        const formData = new FormData(event.target);
        const data = {};

        // Disable submit button
        const submitButton = document.getElementById("submit-btn");
        submitButton.textContent = "Loading...";
        submitButton.disabled = "true";
        submitButton.style.opacity = ".5";

        // Handle regular form fields and checkboxes properly
        for (let [key, value] of formData.entries()) {
          if (data[key]) {
            // Handle multiple values (like checkboxes)
            if (Array.isArray(data[key])) {
              data[key].push(value);
            } else {
              data[key] = [data[key], value];
            }
          } else {
            data[key] = value;
          }
        }

        try {
          console.log("Submitting questionnaire data:", data);
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": API_GATEWAY_KEY,
            },
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();
          console.log("Response from lambda:", result);
          const recommendation = result.therapistRecommendation;
          if (recommendation) {
            responseDiv.innerHTML = successMessage(recommendation);
          } else {
            responseDiv.textContent = "Recommendation received but format was unexpected.";
          }
          responseDiv.className = "response-message success";
          this.page = 7;
        } catch (error) {
          if (error instanceof Error) {
            console.error("Error submitting questionnaire:", error);
            responseDiv.textContent = `There was an error submitting your questionnaire: ${error.message}. Please try again or contact support.`;
          } else {
            console.error("Error submitting questionnaire:", error);
            responseDiv.textContent = `There was an error submitting your questionnaire: ${error}. Please try again or contact support.`;
          }
          responseDiv.className = "response-message error";
          this.page = 7;
        }
      },
    };
  });
});

// Scripts
