// Accessibility Utilities - Focus management and keyboard navigation

import { useCallback, useEffect, useRef } from 'react';

// Focus trap for modals and dropdowns
export function useFocusTrap(isActive: boolean) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isActive || !containerRef.current) return;

        const container = containerRef.current;
        const focusableElements = container.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement?.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement?.focus();
                }
            }
        };

        // Focus first element on open
        firstElement?.focus();

        container.addEventListener('keydown', handleKeyDown);
        return () => container.removeEventListener('keydown', handleKeyDown);
    }, [isActive]);

    return containerRef;
}

// Escape key handler
export function useEscapeKey(callback: () => void, isActive: boolean = true) {
    useEffect(() => {
        if (!isActive) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') callback();
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [callback, isActive]);
}

// Click outside handler
export function useClickOutside(
    ref: React.RefObject<HTMLElement>,
    callback: () => void,
    isActive: boolean = true
) {
    useEffect(() => {
        if (!isActive) return;

        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                callback();
            }
        };

        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [ref, callback, isActive]);
}

// Announce to screen readers
export function useAnnounce() {
    const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
        const announcer = document.createElement('div');
        announcer.setAttribute('aria-live', priority);
        announcer.setAttribute('aria-atomic', 'true');
        announcer.className = 'sr-only';
        document.body.appendChild(announcer);

        // Small delay for screen reader to pick up
        setTimeout(() => {
            announcer.textContent = message;
        }, 100);

        // Clean up
        setTimeout(() => {
            document.body.removeChild(announcer);
        }, 1000);
    }, []);

    return announce;
}

// Keyboard navigation for lists
export function useArrowNavigation(
    containerRef: React.RefObject<HTMLElement>,
    itemSelector: string = '[role="option"], button, a'
) {
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const items = Array.from(container.querySelectorAll<HTMLElement>(itemSelector));
            const currentIndex = items.findIndex(item => item === document.activeElement);

            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                const nextIndex = (currentIndex + 1) % items.length;
                items[nextIndex]?.focus();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
                items[prevIndex]?.focus();
            } else if (e.key === 'Home') {
                e.preventDefault();
                items[0]?.focus();
            } else if (e.key === 'End') {
                e.preventDefault();
                items[items.length - 1]?.focus();
            }
        };

        container.addEventListener('keydown', handleKeyDown);
        return () => container.removeEventListener('keydown', handleKeyDown);
    }, [containerRef, itemSelector]);
}
