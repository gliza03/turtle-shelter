document.addEventListener('DOMContentLoaded', function() {
    // Handle desktop navigation clicks
    const navButtons = document.querySelectorAll('.nav-section');
    const sections = document.querySelectorAll('.content-section');
    
    function switchSection(sectionId) {
        // Update navigation buttons
        navButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.section === sectionId) {
                btn.classList.add('active');
            }
        });
        
        // Update content sections
        sections.forEach(section => {
            section.classList.remove('active');
            if (section.id === sectionId) {
                section.classList.add('active');
            }
        });
    }

    // Desktop nav click handlers
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            switchSection(button.dataset.section);
        });
    });

    // Mobile dropdown handler
    const mobileSelect = document.getElementById('section-select');
    mobileSelect.addEventListener('change', (e) => {
        switchSection(e.target.value);
    });

    // Check for hash in URL and switch to that section if it exists
    const hash = window.location.hash.slice(1); // Remove the # symbol
    if (hash) {
        switchSection(hash);
        // Update mobile select if it exists
        if (mobileSelect) {
            mobileSelect.value = hash;
        }
    } else {
        // Only default to 'vests' if there's no hash
        switchSection('vests');
    }
});