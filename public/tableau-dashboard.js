function loadTableauDashboards() {
    const placeholders = document.querySelectorAll('.tableauPlaceholder');
    placeholders.forEach(placeholder => {
        const vizUrl = placeholder.querySelector('param[name="host_url"]').value;
        const options = {
            hideTabs: true,
            hideToolbar: true,
            width: '100%',
            height: '100%'
        };
        
        // Initialize the viz
        new tableau.Viz(placeholder, vizUrl, options);
    });
}

// Load Tableau JS API and initialize dashboards
function initTableau() {
    const script = document.createElement('script');
    script.src = 'https://public.tableau.com/javascripts/api/tableau-2.min.js';
    script.onload = loadTableauDashboards;
    document.head.appendChild(script);
}

// Call initialization when the document is ready
document.addEventListener('DOMContentLoaded', initTableau);