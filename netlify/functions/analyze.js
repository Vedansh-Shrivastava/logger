export default async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', {
            status: 405
        });
    }

    const {
        prompt,
        apiKey
    } = await req.json();

    if (!apiKey) {
        return new Response(JSON.stringify({
            error: 'API key required'
        }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json'
            },
        });
    }

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'meta/llama-3.1-8b-instruct',
            max_tokens: 1000,
            messages: [{
                role: 'user',
                content: prompt
            }],
        }),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
        status: response.status,
        headers: {
            'Content-Type': 'application/json'
        },
    });
};

export const config = {
    path: '/api/analyze',
    maxDuration: 60,
};