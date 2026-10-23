(() => {
  "use strict";

  // Demo storage only: these ratings live in this browser, not on a server.
  const STORAGE_KEY = "karavan-demo-seller-ratings-v1";
  const params = new URLSearchParams(window.location.search);
  const SELLER_KEY = params.get("seller") || "demo-seller";
  const labels = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
  const $ = id => document.getElementById(id);
  const form = $("rating-form");
  const submitButton = $("submit-rating");
  const reviewInput = $("review");
  const ratingInputs = [...document.querySelectorAll('input[name="rating"]')];
  let selectedRating = 0;
  let ratings = readRatings();

  function readRatings() {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return Array.isArray(all[SELLER_KEY]) ? all[SELLER_KEY] : [];
    } catch { return []; }
  }

  function writeRatings() {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      all[SELLER_KEY] = ratings;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      return true;
    } catch {
      showMessage("Your browser couldn't save this rating. Check your browser storage settings.", "error");
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    })[char]);
  }

  function starString(value) {
    const rounded = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    return "★".repeat(rounded) + "☆".repeat(5 - rounded);
  }

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

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString([], {
      year:"numeric", month:"short", day:"numeric"
    });
  }

  function render() {
    const count = ratings.length;
    const average = count ? ratings.reduce((sum, item) => sum + item.rating, 0) / count : 0;
    $("average-rating").textContent = count ? average.toFixed(1) : "—";
    $("summary-stars").textContent = starString(average);
    $("summary-stars").setAttribute("aria-label", count ? `${average.toFixed(1)} out of 5 stars` : "No ratings yet");
    $("rating-count").textContent = count ? `${count} ${count === 1 ? "rating" : "ratings"}` : "No ratings yet";
    $("reviews-subheading").textContent = `${count} ${count === 1 ? "review" : "reviews"}`;

    if (!count) {
      $("reviews-list").innerHTML = '<div class="empty-reviews">No reviews yet. Be the first to rate this seller.</div>';
      return;
    }

    const sorted = [...ratings].sort((a, b) => b.createdAt - a.createdAt);
    $("reviews-list").innerHTML = sorted.map(item => `
      <article class="review-card">
        <div class="review-top">
          <div>
            <div class="review-author">${escapeHTML(item.name || "Karavan user")}</div>
            <div class="review-date">${escapeHTML(formatDate(item.createdAt))}</div>
          </div>
          <div class="review-stars" aria-label="${item.rating} out of 5 stars">${starString(item.rating)}</div>
        </div>
        ${item.review ? `<p class="review-text">${escapeHTML(item.review)}</p>` : ""}
      </article>
    `).join("");
  }

  ratingInputs.forEach(input => input.addEventListener("change", () => updateSelectedRating(input.value)));
  reviewInput.addEventListener("input", () => {
    $("character-count").textContent = `${reviewInput.value.length} / 1000`;
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (selectedRating < 1 || selectedRating > 5) {
      showMessage("Please select a star rating.", "error");
      return;
    }

    // Demo behavior: one editable rating per browser per seller key.
    const newRating = {
      id: SELLER_KEY,
      rating: selectedRating,
      review: reviewInput.value.trim(),
      name: "You",
      createdAt: Date.now()
    };
    const existingIndex = ratings.findIndex(item => item.id === SELLER_KEY);
    if (existingIndex >= 0) ratings[existingIndex] = newRating;
    else ratings.push(newRating);

    if (!writeRatings()) return;
    render();
    showMessage("Your rating has been saved in this browser.", "success");
  });

  $("clear-demo").addEventListener("click", () => {
    if (!window.confirm("Clear the demo rating for this seller from this browser?")) return;
    ratings = [];
    if (!writeRatings()) return;
    render();
    form.reset();
    reviewInput.value = "";
    $("character-count").textContent = "0 / 1000";
    updateSelectedRating(0);
    showMessage("Ratings cleared for this seller in this browser.", "success");
  });

  // Optional URL parameters: ratings.html?seller=12&name=SellerName
  const displayName = params.get("name");
  if (displayName) {
    $("page-title").textContent = `${displayName}'s ratings`;
    $("seller-avatar").textContent = displayName.trim().charAt(0).toUpperCase() || "S";
  }

  updateSelectedRating(0);
  render();
})();
