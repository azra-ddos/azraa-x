// Color transition during attack
let colorInterval = null;
let hueValue = 210; // Start with blue (210°)

function startColorTransition() {
    if (colorInterval) clearInterval(colorInterval);
    
    hueValue = 210; // Reset to blue
    colorInterval = setInterval(() => {
        // Gradually shift from blue (210°) to red (0°/360°)
        hueValue = (hueValue - 2) % 360;
        if (hueValue < 0) hueValue = 360 + hueValue;
        
        // Apply to visualization container
        const container = document.getElementById('visual-container');
        if (container) {
            // Calculate intermediate colors
            const saturation = 80 + Math.sin(Date.now() / 500) * 20;
            const lightness = 40 + Math.cos(Date.now() / 700) * 10;
            
            container.style.backgroundColor = `hsl(${hueValue}, ${saturation}%, ${lightness}%)`;
            container.style.boxShadow = `0 0 60px hsl(${hueValue}, 100%, 50%)`;
            
            // Update pulse ring color
            const pulseRing = document.querySelector('.pulse-ring');
            if (pulseRing) {
                pulseRing.style.borderColor = `hsl(${hueValue}, 100%, 60%)`;
            }
            
            // Update metrics color based on intensity
            if (hueValue > 300 || hueValue < 30) {
                // Red zone
                document.querySelectorAll('.metric-value').forEach(el => {
                    el.style.color = `hsl(${hueValue}, 100%, 70%)`;
                });
            }
        }
        
        // If fully red, stop shifting
        if ((hueValue >= 350 || hueValue <= 10) && !document.querySelector('.attack-active')) {
            clearInterval(colorInterval);
        }
    }, 50);
}

function resetColors() {
    if (colorInterval) {
        clearInterval(colorInterval);
        colorInterval = null;
    }
    
    const container = document.getElementById('visual-container');
    if (container) {
        container.style.backgroundColor = '';
        container.style.boxShadow = '';
        
        const pulseRing = document.querySelector('.pulse-ring');
        if (pulseRing) {
            pulseRing.style.borderColor = 'var(--blue)';
        }
        
        document.querySelectorAll('.metric-value').forEach(el => {
            el.style.color = 'var(--gold)';
        });
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { startColorTransition, resetColors };
}