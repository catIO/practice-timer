document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const captionText = document.querySelector('.modal-caption');
    const closeBtn = document.querySelector('.close-modal');
    const prevBtn = document.querySelector('.modal-prev');
    const nextBtn = document.querySelector('.modal-next');
    
    let currentIndex = 0;
    const images = document.querySelectorAll('.guitar-card img');


    function toggleMenu() {
        const topnav = document.querySelector('.topnav');
        topnav.style.display = topnav.style.display === 'block' ? 'none' : 'block';
        alert("sdf");
    }

    
    // Open modal
    images.forEach((img, index) => {
        img.addEventListener('click', function(e) {
            e.preventDefault();
            modal.style.display = "block";
            modalImg.src = this.src;
            captionText.innerHTML = this.alt;
            currentIndex = index;
            updateNavigation();
        });
    });
    
    // Close modal
    closeBtn.addEventListener('click', function() {
        modal.style.display = "none";
    });
    
    // Next image
    nextBtn.addEventListener('click', function() {
        currentIndex = (currentIndex + 1) % images.length;
        updateImage();
    });
    
    // Previous image
    prevBtn.addEventListener('click', function() {
        currentIndex = (currentIndex - 1 + images.length) % images.length;
        updateImage();
    });
    
    // Update image and caption
    function updateImage() {
        modalImg.src = images[currentIndex].src;
        captionText.innerHTML = images[currentIndex].alt;
        updateNavigation();
    }
    
    // Update navigation visibility
    function updateNavigation() {
        prevBtn.style.display = images.length > 1 ? "block" : "none";
        nextBtn.style.display = images.length > 1 ? "block" : "none";
    }
    
    // Close on outside click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = "none";
        }
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (modal.style.display === "block") {
            if (e.key === "ArrowRight") nextBtn.click();
            if (e.key === "ArrowLeft") prevBtn.click();
            if (e.key === "Escape") modal.style.display = "none";
        }
    });
}); 