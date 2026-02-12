document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.btn-favorite').forEach(button => {
    button.addEventListener('click', function() {
      const movieName = this.dataset.movie;

      if (this.classList.contains('favorited')) {
        this.classList.remove('favorited');
        this.innerHTML = '<i class="far fa-heart"></i> Add to Favorites';
        alert(`Removed "${movieName}" from favorites`);
      } else {
        this.classList.add('favorited');
        this.innerHTML = '<i class="fas fa-heart"></i> In Favorites';
        alert(`Added "${movieName}" to favorites!`);
      }
    });
  });

  document.querySelectorAll('.btn-info').forEach(button => {
    button.addEventListener('click', function() {
      const movieName = this.dataset.movie;
      alert(`Movie information for "${movieName}" will be available in future versions.`);
    });
  });
});