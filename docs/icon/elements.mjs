// elements.mjs
// Central shared module providing access to DOM elements with IDs

// Converts kebab-case IDs to camelCase keys
function kebabToCamel(str) {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Immediately initialize and cache the element mapping.
// Assumes DOM is fully loaded when this module is imported.
const dom = Array.from(document.querySelectorAll('[id]')).reduce((acc, element) => {
    acc[kebabToCamel(element.id)] = element;
    return acc;
}, {});

export default dom;
