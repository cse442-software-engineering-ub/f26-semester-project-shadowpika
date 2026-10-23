
(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const SELLER_KEY = params.get("seller");
  const labels = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

  const $ = id => document.getElementById(id);
  const form = $("rating-form");
  const submitButton = $("submit-rating");
  const reviewInput = $("review");
  const ratingInputs = [...document.querySelectorAll('input[name="rating"]')];

  let selectedRating = 0;
  let ratings = [];
  let username = "Seller";

  // Assumes rating.php is in the same directory as ratings.html.
  const API_URL = "api/ratings.php";

  function showMessage(message, type = "") {
    $("form-message").textContent = message;
    $("form-message").className = `form-message ${type}`.trim();
  }

  function updateSelectedRating(value) {
    selectedRating = Number(value) || 0;

    $("star-hint").textContent = selectedRating
      ? `${labels[selectedRating]} — ${selectedRating} out of 5 stars`
      : "Select a star rating";

    submitButton.disabled = selectedRating < 1 || selectedRating > 5;
  }

  function starString(value) {
    const rounded = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    return "★".repeat(rounded) + "☆".repeat(5 - rounded);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleDateString([], {
          year: "numeric",
          month: "short",
          day: "numeric"
        });
  }

  function render() {
    const count = ratings.length;

    document.getElementById("eyebrow").textContent = `${username}'s PROFILE`;
    document.getElementById("page-title").textContent = `${username}'s ratings`;

    const average = count
      ? ratings.reduce((sum, item) => sum + Number(item.rating), 0) / count
      : 0;

    $("average-rating").textContent = count ? average.toFixed(1) : "—";
    $("summary-stars").textContent = starString(average);

    $("summary-stars").setAttribute(
      "aria-label",
      count ? `${average.toFixed(1)} out of 5 stars` : "No ratings yet"
    );

    $("rating-count").textContent = count
      ? `${count} ${count === 1 ? "rating" : "ratings"}`
      : "No ratings yet";

    $("reviews-subheading").textContent =
      `${count} ${count === 1 ? "review" : "reviews"}`;

    if (!count) {
      $("reviews-list").innerHTML =
        '<div class="empty-reviews">No reviews yet. Be the first to rate this seller.</div>';
      return;
    }

    const sorted = [...ratings].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    $("reviews-list").innerHTML = sorted.map(item => `
      <article class="review-card">
        <div class="review-top">
          <div>
            <div class="review-author">
              ${escapeHTML(item.name || "Karavan user")}
            </div>
            <div class="review-date">
              ${escapeHTML(formatDate(item.createdAt))}
            </div>
          </div>
          <div class="review-stars"
               aria-label="${Number(item.rating)} out of 5 stars">
            ${starString(item.rating)}
          </div>
        </div>
        ${item.review
          ? `<p class="review-text">${escapeHTML(item.review)}</p>`
          : ""}
      </article>
    `).join("");
  }

  // Load shared ratings from the PHP endpoint.
  async function loadRatings() {
    if (!SELLER_KEY) {
      showMessage("A seller ID is required in the page URL.", "error");
      $("reviews-list").innerHTML =
        '<div class="empty-reviews">Unable to load ratings without a seller ID.</div>';
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}?seller_id=${encodeURIComponent(SELLER_KEY)}`,
        {
          method: "GET",
          headers: { "Accept": "application/json" },
          credentials: "same-origin"
        }
      );

      const data = await response.json();

      if (!response.ok || data.success !== true) {
        throw new Error(data.message || "Could not load ratings.");
      }

      ratings = Array.isArray(data.ratings) ? data.ratings : [];
      username = data.seller_name ?? "Seller";
      render();
    } catch (error) {
      showMessage(error.message || "Could not load ratings.", "error");
    }
  }

  ratingInputs.forEach(input => {
    input.addEventListener("change", () => {
      updateSelectedRating(input.value);
    });
  });

  reviewInput.addEventListener("input", () => {
    $("character-count").textContent = `${reviewInput.value.length} / 1000`;
  });

  // Submit a rating to rating.php.
  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!SELLER_KEY) {
      showMessage("A seller ID is required.", "error");
      return;
    }

    if (selectedRating < 1 || selectedRating > 5) {
      showMessage("Please select a star rating.", "error");
      return;
    }

    submitButton.disabled = true;
    showMessage("Submitting rating...");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({
          seller_id: SELLER_KEY,
          rating: selectedRating,
          review: reviewInput.value.trim()
        })
      });

      const data = await response.json();

      if (!response.ok || data.success !== true) {
        throw new Error(data.message || "Could not save your rating.");
      }

      showMessage("Your rating has been saved.", "success");

      // Reload the server's latest ratings.
      await loadRatings();
    } catch (error) {
      showMessage(error.message || "Could not save your rating.", "error");
    } finally {
      submitButton.disabled = selectedRating < 1 || selectedRating > 5;
    }
  });

  // This button now resets the form only; it does not delete database records.
  // $("clear-demo").addEventListener("click", () => {
  //   form.reset();
  //   reviewInput.value = "";
  //   $("character-count").textContent = "0 / 1000";
  //   updateSelectedRating(0);
  //   showMessage("Form cleared.");
  // });

  const displayName = params.get("name");

  if (displayName) {
    $("page-title").textContent = `${displayName}'s ratings`;
    $("seller-avatar").textContent =
      displayName.trim().charAt(0).toUpperCase() || "S";
  }

  updateSelectedRating(0);
  loadRatings();
})();
