const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

async function callVllm(content, modelName = 'huihui-ai/Qwen3-14B-abliterated-nf4') {
    return new Promise((resolve, reject) => {
        // Per-invocation state
        let hasResolved = false;
        let cleanupPerformed = false;
        let req = null;
        let res = null;
        let inactivityInterval = null;
        let agent = null;

        // Accumulators
        let fullResponse = '';
        let filteredResponse = '';
        let startTagFound = false;
        let endTagFound = false;
        let lastActivityTime = Date.now();

        // Helper to end, cleanup and resolve/reject safely once
        const safeResolve = (value) => {
            if (hasResolved) return;
            hasResolved = true;
            cleanup();
            resolve(value);
        };

        const safeReject = (error) => {
            if (hasResolved) return;
            hasResolved = true;
            cleanup();
            reject(error);
        };

        const cleanup = () => {
            if (cleanupPerformed) return;
            cleanupPerformed = true;

            try { if (inactivityInterval) clearInterval(inactivityInterval); } catch (_) { }

            try { if (res && typeof res.destroy === 'function') res.destroy(); } catch (_) { }
            try { if (req && typeof req.destroy === 'function') req.destroy(); } catch (_) { }
            try { if (agent && typeof agent.destroy === 'function') agent.destroy(); } catch (_) { }
        };

        try {
            const token = process.env.VLLM_TOKEN;
            const host = process.env.VLLM_HOST;
            const model = process.env.VLLM_MODEL || modelName;

            if (!token || !host || !model) {
                throw new Error('VLLM_TOKEN, VLLM_HOST, and VLLM_MODEL environment variables are required');
            }

            // Build prompt with explicit start/end markers and strict no‑preamble rules
            const prompt = [
                'SYSTEM: You are a writing engine. Output ONLY the final article as plain text Markdown.',
                'RULES:',
                '1) Begin output with <<<START>>>',
                '2) End output with <<<END>>>',
                '3) Do NOT include any text before <<<START>>> or after <<<END>>>',
                '4) No preambles, explanations, planning, or chatty phrases like "Let\'s begin"',
                '5) If YAML frontmatter is required, place it immediately after <<<START>>>, and never use backticks',
                '',
                String(content)
            ].join('\n');

            // Determine protocol/hostname/port/path
            let protocolModule = https;
            let hostname;
            let port;
            let isHttps = true;

            if (host.startsWith('http://') || host.startsWith('https://')) {
                const url = new URL(host);
                hostname = url.hostname;
                isHttps = url.protocol === 'https:';
                protocolModule = isHttps ? https : http;
                port = Number(url.port) || (isHttps ? 443 : 80);
            } else {
                // Default to HTTPS if only hostname provided
                hostname = host;
                isHttps = true;
                protocolModule = https;
                port = 443;
            }

            // Endpoint path
            const apiPath = '/v1/completions';

            // Disable connection reuse to avoid stream bleed across calls
            agent = isHttps
                ? new https.Agent({ keepAlive: false, maxSockets: 1 })
                : new http.Agent({ keepAlive: false, maxSockets: 1 });

            const options = {
                hostname,
                port,
                path: apiPath,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Connection': 'close'
                },
                agent,
                timeout: 180000 // 3 minutes
            };

            // Regex patterns for start and end tags with variations
            const startTagRegex = /[<>]{3}start[<>]{3}/i; // matches <<<START>>>
            const endTagRegex = /[<>]{3}end[<>]{3}/i;     // matches <<<END>>>

            // Create request
            req = protocolModule.request(options, (response) => {
                res = response;
                const startTime = Date.now();
                let buffer = '';

                res.setEncoding('utf8');
                console.log('Connected to VLLM');

                res.on('data', (chunk) => {
                    if (hasResolved) return; // ignore late chunks
                    lastActivityTime = Date.now();
                    buffer += chunk;

                    // Process Server-Sent Events style lines
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // keep unfinished line

                    for (const line of lines) {
                        if (!line.startsWith('data:')) continue;
                        const jsonStr = line.slice(5).trim();

                        if (jsonStr === '[DONE]') {
                            // Server signals completion; finalize if not already done
                            if (!hasResolved) {
                                return finalizeAndResolve();
                            }
                            return;
                        }

                        try {
                            const data = JSON.parse(jsonStr);
                            const text = data.choices?.[0]?.text || '';

                            // Accumulate full text
                            fullResponse += text;
                            process.stdout.write(text);

                            // Update filtered based on markers
                            if (!startTagFound && startTagRegex.test(fullResponse)) {
                                startTagFound = true;
                                console.log('Start tag found');
                                const startMatch = fullResponse.match(startTagRegex);
                                if (startMatch) {
                                    const startIndex = fullResponse.indexOf(startMatch[0]);
                                    if (startIndex !== -1) {
                                        filteredResponse = fullResponse.substring(startIndex + startMatch[0].length);
                                    }
                                }
                            } else if (startTagFound && !endTagFound && endTagRegex.test(fullResponse)) {
                                endTagFound = true;
                                console.log('End tag found');
                                const endMatch = fullResponse.match(endTagRegex);
                                if (endMatch) {
                                    const endIndex = fullResponse.indexOf(endMatch[0]);
                                    if (endIndex !== -1) {
                                        const startMatch = fullResponse.match(startTagRegex);
                                        if (startMatch) {
                                            const startIndex = fullResponse.indexOf(startMatch[0]);
                                            if (startIndex !== -1) {
                                                filteredResponse = fullResponse.substring(
                                                    startIndex + startMatch[0].length,
                                                    endIndex
                                                );
                                            }
                                        }
                                    }
                                }
                                // Early terminate as soon as we found the end tag
                                return finalizeAndResolve();
                            } else if (startTagFound && !endTagFound) {
                                // Still inside the delimited content
                                filteredResponse += text;
                            }
                        } catch (e) {
                            // Bad JSON line; ignore but track activity
                        }
                    }
                });

                res.on('end', () => {
                    if (hasResolved) return;
                    finalizeAndResolve();
                });

                res.on('close', () => {
                    if (hasResolved) return;
                    // If we have content, resolve; otherwise reject
                    if (filteredResponse) {
                        console.log('Filtered response: ', filteredResponse);
                        return safeResolve(filteredResponse);
                    }
                    return safeReject(new Error('Stream closed without valid response'));
                });

                res.on('error', (error) => {
                    if (hasResolved) return;
                    return safeReject(error);
                });

                function finalizeAndResolve() {
                    // Persist full response to file optionally
                    try {
                        if (process.env.VLLM_SAVE_FULL_RESPONSE === '1') {
                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                            const filename = `vllm_response_${timestamp}.txt`;
                            const filepath = path.join(__dirname, '..', '..', filename);
                            fs.writeFileSync(filepath, fullResponse, 'utf8');
                        }
                    } catch (_) { }

                    // Prefer filteredResponse if present; fallback to fullResponse
                    const result = filteredResponse || fullResponse;
                    return safeResolve(result);
                }
            });

            // Strengthen timeouts and connection behavior
            try { req.setNoDelay?.(true); } catch (_) { }

            req.on('error', (e) => {
                return safeReject(e);
            });

            req.on('timeout', () => {
                return safeReject(new Error('Request timeout'));
            });

            // Inactivity watchdog (handles stalled streams)
            inactivityInterval = setInterval(() => {
                const timeSinceLastActivity = Date.now() - lastActivityTime;
                if (timeSinceLastActivity > 30000) { // 30 seconds of inactivity
                    if (filteredResponse) {
                        return safeResolve(filteredResponse);
                    }
                    return safeReject(new Error('Inactivity timeout'));
                }
            }, 5000);

            // Send request body
            const body = {
                model: model,
                prompt: prompt,
                max_tokens: 2400,
                temperature: 0.6,
                stream: true,
                stop: ["<<<END>>>"]
            };

            req.write(JSON.stringify(body));
            req.end();
        } catch (error) {
            return safeReject(error);
        }
    });
}

module.exports = { callVllm };
