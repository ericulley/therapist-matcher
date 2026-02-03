// Apline Data Handler
document.addEventListener("alpine:init", () => {
  Alpine.data("matcher", () => {
    return {
      // Site Properties
      page: 1,
      isLoading: false,
      loaderDelay: 2,

      // Form Data
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

      // Site Functions
      nextPage() {
        if (this.page < 8) this.page++;
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

      validateInputs(pageNumber) {
        if (pageNumber === 0) {
        }
        if (pageNumber === 1) {
        }
      },

      timeoutInSeconds(seconds) {
        return new Promise((resolve) => {
          setTimeout(() => resolve(), seconds * 1000);
        });
      },

      async startLoader() {
        this.isLoading = true;
        const loaderPhrases = LOADER_PHRASES;
        const finalPhrase = FINAL_LOADER_PHRASE;
        const phraseContainer = document.getElementById("loader-phrase");

        // Loop through phrases while loading
        let i = 0;
        while (this.isLoading) {
          phraseContainer.textContent = loaderPhrases[i];
          i = (i + 1) % loaderPhrases.length;
          await this.timeoutInSeconds(this.loaderDelay);
        }
        phraseContainer.textContent = finalPhrase;
      },

      async submitQuestionaire(event) {
        this.page = 8;
        const formData = new FormData(event.target);
        const data = {};

        // Format regular form fields and checkboxes properly
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
          this.startLoader();

          const response = await fetch(API_GATEWAY_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": API_GATEWAY_KEY,
            },
            body: JSON.stringify(data),
          });

          if (response.ok) {
            this.isLoading = false;
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();
          console.log("Response from lambda:", result);

          const profileUrl = result.therapistRecommendation.therapistProfile;
          if (profileUrl) {
            await this.timeoutInSeconds(this.loaderDelay);
            window.location.href = profileUrl;
          } else {
            throw new Error("Therapist profile URL could not be parsed.");
          }
        } catch (error) {
          if (error instanceof Error) {
            console.error("Error submitting questionnaire:", error);
            window.location.href = "https://frogpointtherapy.com/team/";
          } else {
            console.error("Error submitting questionnaire:", error);
            window.location.href = "https://frogpointtherapy.com/team/";
          }
        }
      },
    };
  });
});
