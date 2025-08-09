// Test the sanitization function directly
function sanitizeResponse(response) {
    if (!response || typeof response !== 'string') {
        return response;
    }
    
    let cleaned = response.trim();
    
    // Remove markdown code blocks (```json, ```, etc.)
    cleaned = cleaned.replace(/```(?:json|js|javascript|markdown)?\s*\n?/gi, '');
    cleaned = cleaned.replace(/```\s*$/gi, '');
    
    // Remove leading/trailing backticks
    cleaned = cleaned.replace(/^`+/, '').replace(/`+$/, '');
    
    // Remove any remaining backticks at the start/end of lines
    cleaned = cleaned.replace(/^\s*`/gm, '').replace(/`\s*$/gm, '');
    
    return cleaned.trim();
}

// Test cases
const testCases = [
    '```json\n{"test": "value"}\n```',
    '```\n{"test": "value"}\n```',
    '`{"test": "value"}`',
    '{"test": "value"}',
    '```markdown\n# Title\n```',
    '```js\nconsole.log("test");\n```'
];

console.log('Testing sanitization...\n');

testCases.forEach((testCase, index) => {
    console.log(`Test case ${index + 1}:`);
    console.log('Input:', testCase);
    const result = sanitizeResponse(testCase);
    console.log('Output:', result);
    console.log('---');
}); 