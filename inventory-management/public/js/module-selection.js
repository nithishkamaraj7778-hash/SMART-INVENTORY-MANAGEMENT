// Module selection page helpers.
document.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.module-card button');
  cards.forEach((button) => {
    button.addEventListener('click', () => {
      button.blur();
    });
  });
});
