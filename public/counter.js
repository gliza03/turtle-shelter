// Add this to a new file named counter.js in your public folder
document.addEventListener('DOMContentLoaded', () => {
    const counters = document.querySelectorAll('.counter');
    let started = false;

    function startCounting(entries, observer) {
        entries.forEach(entry => {
            if (entry.isIntersecting && !started) {
                started = true;
                counters.forEach(counter => {
                    const target = parseInt(counter.getAttribute('data-target'));
                    const duration = 2000; // 2 seconds
                    const increment = target / (duration / 16); // 60fps
                    let current = 0;

                    const updateCount = () => {
                        if (current < target) {
                            current += increment;
                            counter.textContent = Math.round(current);
                            requestAnimationFrame(updateCount);
                        } else {
                            counter.textContent = target;
                        }
                    };

                    updateCount();
                });
                observer.unobserve(entry.target);
            }
        });
    }

    const observer = new IntersectionObserver(startCounting, {
        threshold: 0.5
    });

    const metricsSection = document.querySelector('.metrics');
    if (metricsSection) {
        observer.observe(metricsSection);
    }
});