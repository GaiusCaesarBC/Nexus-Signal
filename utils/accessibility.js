// client/src/utils/accessibility.js - WCAG Compliance Utilities

// ============================================
// KEYBOARD NAVIGATION HELPERS
// ============================================

// Handle keyboard navigation for custom components
export const handleKeyboardNavigation = (event, actions) => {
    const { onEnter, onEscape, onArrowUp, onArrowDown, onTab } = actions;

    switch (event.key) {
        case 'Enter':
            onEnter?.();
            break;
        case 'Escape':
            onEscape?.();
            break;
        case 'ArrowUp':
            event.preventDefault();
            onArrowUp?.();
            break;
        case 'ArrowDown':
            event.preventDefault();
            onArrowDown?.();
            break;
        case 'Tab':
            onTab?.(event);
            break;
        default:
            break;
    }
};

// ============================================
// FOCUS MANAGEMENT
// ============================================

// Trap focus within a modal/dialog
export const trapFocus = (element) => {
    const focusableElements = element.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                lastElement.focus();
                e.preventDefault();
            }
        } else {
            if (document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
            }
        }
    };

    element.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
        element.removeEventListener('keydown', handleTabKey);
    };
};

// Restore focus to previous element
export const createFocusLock = () => {
    const previousFocus = document.activeElement;
    return () => previousFocus?.focus();
};

// ============================================
// ARIA HELPERS
// ============================================

// Generate unique IDs for aria attributes
export const generateAriaId = (prefix = 'aria') => {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
};

// Announce to screen readers
export const announceToScreenReader = (message, priority = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
};

// ============================================
// COLOR CONTRAST CHECKER
// ============================================

// Check if color contrast meets WCAG AA standards (4.5:1 for normal text)
export const checkColorContrast = (foreground, background) => {
    const getLuminance = (hex) => {
        const rgb = parseInt(hex.slice(1), 16);
        const r = (rgb >> 16) & 0xff;
        const g = (rgb >> 8) & 0xff;
        const b = (rgb >> 0) & 0xff;
        
        const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const l1 = getLuminance(foreground);
    const l2 = getLuminance(background);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    
    return {
        ratio: ratio.toFixed(2),
        passesAA: ratio >= 4.5,
        passesAAA: ratio >= 7,
    };
};

// ============================================
// SCREEN READER ONLY STYLES
// ============================================

export const srOnlyStyles = `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
`;

// ============================================
// SKIP NAVIGATION LINK
// ============================================

export const SkipLink = `
    position: absolute;
    top: -40px;
    left: 0;
    background: #00adef;
    color: white;
    padding: 8px;
    text-decoration: none;
    z-index: 100;
    
    &:focus {
        top: 0;
    }
`;

// ============================================
// USAGE EXAMPLES
// ============================================

/*

// 1. ADD SCREEN READER ONLY TEXT
import styled from 'styled-components';
import { srOnlyStyles } from './utils/accessibility';

const SROnly = styled.span`
    ${srOnlyStyles}
`;

<button>
    <Icon />
    <SROnly>Close dialog</SROnly>
</button>


// 2. ANNOUNCE MESSAGES TO SCREEN READERS
import { announceToScreenReader } from './utils/accessibility';

const handleSuccess = () => {
    announceToScreenReader('Stock added to watchlist successfully');
};


// 3. KEYBOARD NAVIGATION
import { handleKeyboardNavigation } from './utils/accessibility';

<div 
    onKeyDown={(e) => handleKeyboardNavigation(e, {
        onEnter: () => handleSelect(),
        onEscape: () => handleClose(),
        onArrowDown: () => navigateDown(),
        onArrowUp: () => navigateUp(),
    })}
>
    ...
</div>


// 4. FOCUS TRAP IN MODAL
import { useEffect } from 'react';
import { trapFocus } from './utils/accessibility';

const Modal = ({ isOpen }) => {
    const modalRef = useRef(null);
    
    useEffect(() => {
        if (isOpen && modalRef.current) {
            const cleanup = trapFocus(modalRef.current);
            return cleanup;
        }
    }, [isOpen]);
    
    return <div ref={modalRef}>...</div>;
};


// 5. CHECK COLOR CONTRAST
import { checkColorContrast } from './utils/accessibility';

const result = checkColorContrast('#00adef', '#0a0e27');
console.log(`Contrast ratio: ${result.ratio}`);
console.log(`Passes WCAG AA: ${result.passesAA}`);


// 6. ADD SKIP NAVIGATION LINK (in App.js)
<a href="#main-content" className="skip-link">
    Skip to main content
</a>

<main id="main-content">
    ...
</main>

// With CSS:
.skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    background: #00adef;
    color: white;
    padding: 8px;
    text-decoration: none;
    z-index: 100;
}

.skip-link:focus {
    top: 0;
}

*/

// ============================================
// ACCESSIBILITY CHECKLIST
// ============================================

/*

✅ KEYBOARD NAVIGATION
- All interactive elements accessible via keyboard
- Visible focus indicators
- Logical tab order
- Skip navigation links

✅ SCREEN READERS
- Semantic HTML (header, nav, main, footer, article)
- Alt text for images
- ARIA labels for icons and buttons
- Live regions for dynamic content

✅ COLOR & CONTRAST
- Text contrast ratio minimum 4.5:1 (WCAG AA)
- Don't rely on color alone
- Colorblind-friendly palette

✅ FORMS
- Labels for all inputs
- Error messages clearly associated
- Required fields indicated
- Form validation accessible

✅ INTERACTIVE ELEMENTS
- Buttons vs Links used correctly
- Modal focus management
- Loading states announced
- Success/error messages announced

✅ RESPONSIVE
- Works at 200% zoom
- Mobile-friendly
- Touch targets minimum 44x44px

*/