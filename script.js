(() => {
  "use strict";

  const TOTAL_SECONDS = 15 * 60;
  const TOTAL_SLIDES = 5;

  const landing = document.getElementById("landing");
  const presentation = document.getElementById("presentation");
  const startButton = document.getElementById("start-button");
  const coverButton = document.getElementById("cover-button");
  const previousButton = document.getElementById("previous-button");
  const nextButton = document.getElementById("next-button");
  const timer = document.getElementById("timer");
  const timerLabel = document.getElementById("timer-label");
  const timerValue = document.getElementById("timer-value");
  const slideLabel = document.getElementById("slide-label");
  const progressPercent = document.getElementById("progress-percent");
  const progressBar = document.getElementById("progress-bar");
  const slides = [...document.querySelectorAll(".slide-panel")];
  const dots = [...document.querySelectorAll("[data-go-to]")];

  let currentSlide = 0;
  let seconds = TOTAL_SECONDS;
  let intervalId = null;
  let started = false;

  function formatTime(value) {
    const minutes = String(Math.floor(value / 60)).padStart(2, "0");
    const remaining = String(value % 60).padStart(2, "0");
    return `${minutes}:${remaining}`;
  }

  function updateTimer() {
    timerValue.textContent = formatTime(seconds);
    const warning = seconds <= 120 && seconds > 0;
    const over = seconds === 0;
    const paused = started && currentSlide === TOTAL_SLIDES - 1 && !over;

    timer.classList.toggle("timer-warning", warning);
    timer.classList.toggle("timer-over", over);
    timerLabel.textContent = over ? "Tempo encerrado" : paused ? "Tempo pausado" : "Tempo restante";
    timer.setAttribute("aria-live", warning || over || paused ? "polite" : "off");
  }

  function showSlide(index) {
    currentSlide = Math.max(0, Math.min(TOTAL_SLIDES - 1, index));

    slides.forEach((slide, position) => {
      slide.hidden = position !== currentSlide;
    });

    dots.forEach((dot, position) => {
      const active = position === currentSlide;
      dot.classList.toggle("active", active);
      if (active) dot.setAttribute("aria-current", "step");
      else dot.removeAttribute("aria-current");
    });

    const percentage = Math.round(((currentSlide + 1) / TOTAL_SLIDES) * 100);
    slideLabel.textContent = `Slide ${currentSlide + 1} de ${TOTAL_SLIDES}`;
    progressPercent.textContent = `${percentage}%`;
    progressBar.style.width = `${percentage}%`;
    previousButton.disabled = currentSlide === 0;
    nextButton.disabled = currentSlide === TOTAL_SLIDES - 1;

    if (started && currentSlide === TOTAL_SLIDES - 1 && intervalId) {
      window.clearInterval(intervalId);
      intervalId = null;
    } else if (started && currentSlide !== TOTAL_SLIDES - 1 && seconds > 0 && !intervalId) {
      beginCountdown();
    }

    updateTimer();
  }

  function beginCountdown() {
    if (intervalId) window.clearInterval(intervalId);
    intervalId = window.setInterval(() => {
      seconds = Math.max(0, seconds - 1);
      updateTimer();
      if (seconds === 0 && intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    }, 1000);
  }

  function startPresentation() {
    started = true;
    seconds = TOTAL_SECONDS;
    landing.hidden = true;
    presentation.hidden = false;
    showSlide(0);
  }

  function returnToCover() {
    started = false;
    if (intervalId) window.clearInterval(intervalId);
    intervalId = null;
    seconds = TOTAL_SECONDS;
    presentation.hidden = true;
    landing.hidden = false;
    showSlide(0);
    updateTimer();
    startButton.focus();
  }

  startButton.addEventListener("click", startPresentation);
  coverButton.addEventListener("click", returnToCover);
  previousButton.addEventListener("click", () => showSlide(currentSlide - 1));
  nextButton.addEventListener("click", () => showSlide(currentSlide + 1));

  dots.forEach((dot) => {
    dot.addEventListener("click", () => showSlide(Number(dot.dataset.goTo)));
  });

  window.addEventListener("keydown", (event) => {
    if (!started && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      startPresentation();
      return;
    }

    if (!started) return;

    if (event.key === "ArrowRight" || event.key === "PageDown") {
      showSlide(currentSlide + 1);
    } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
      showSlide(currentSlide - 1);
    } else if (event.key === "Home") {
      showSlide(0);
    } else if (event.key === "End") {
      showSlide(TOTAL_SLIDES - 1);
    } else if (event.key === "Escape") {
      returnToCover();
    }
  });

  showSlide(0);
  updateTimer();
})();
