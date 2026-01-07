const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const AWS_REGION = 'us-west-2';

// Initialize Bedrock Runtime client (AWS SDK v3)
const bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });

/**
 * Load therapist profiles from markdown file
 * @returns {string} Content of therapist profiles file
 */
const loadTherapistProfiles = () => {
    try {
        const profilesPath = path.join(__dirname, 'therapist-profiles.md');
        return fs.readFileSync(profilesPath, 'utf-8');
    } catch (error) {
        console.error('Error loading therapist profiles:', error);
        return 'Error loading therapist profiles';
    }
}

/**
 * @typedef {Object} UserData
 * @property {string} name - Client's full name
 * @property {string} email - Client's email address
 * @property {string} phone - Client's phone number
 * @property {string} location - Client's location
 */

/**
 * Record user data to Google Sheets
 * @param {QuestionnaireData} questionnaireData - Client questionnaire responses
 * @returns {Promise<void>}
 */
const recordUserData = async (questionnaireData) => {
    try {
        // Extract first four fields to create UserData object
        const userData = {
            name: questionnaireData.name,
            email: questionnaireData.email,
            phone: questionnaireData.phone,
            location: questionnaireData.location
        };

        // Initialize Google Sheets API with service account credentials
        const auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;

        // Prepare row data
        const values = [
            [
                userData.email,
                userData.name,
                userData.phone,
                userData.location,
                new Date().toISOString() // Timestamp
            ]
        ];

        // Append row to the sheet
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Sheet1!A:E',
            valueInputOption: 'RAW',
            requestBody: {
                values
            }
        });

        console.log('User data recorded successfully:', userData);
    } catch (error) {
        console.error('Error recording user data to Google Sheets:', error);
        // throw error;
    }
}

/**
 * @typedef {Object} QuestionnaireData
 * @property {string} name - Client's full name
 * @property {string} email - Client's email address
 * @property {string} phone - Client's phone number
 * @property {string} location - Client's location
 * @property {string} sessionType - Session type preference (in-person, virtual, either-both)
 * @property {string[]} primaryConcerns - Array of primary mental health concerns
 * @property {string[]} personalityTraits - Array of personality traits
 * @property {string} distressLevel - Distress level from 1-10
 * @property {string} previousTherapy - Client's previous therapy experience
 * @property {string} therapyApproach - Preferred therapy approach
 * @property {string} [comments] - Optional additional comments
 */

/**
 * Create prompt for LLM to match therapist based on questionnaire data
 * @param {QuestionnaireData} questionnaireData - Client questionnaire responses
 * @param {string} therapistProfiles - Available therapist profiles
 * @returns {string} Formatted prompt for the LLM
 */
const createMatchingPrompt = (questionnaireData, therapistProfiles) => {
    return `You are an expert therapist matching system. Based on the client's questionnaire responses and the available therapist profiles, recommend the best therapist match.

    CLIENT QUESTIONNAIRE DATA:
    - Name: ${questionnaireData.name}
    - Location: ${questionnaireData.location}
    - Session Type Preference: ${questionnaireData.sessionType || 'Not specified'}
    - Primary Concerns: ${Array.isArray(questionnaireData.primaryConcerns) ? questionnaireData.primaryConcerns.join(', ') : questionnaireData.primaryConcerns || 'Not specified'}
    - Personality Traits: ${Array.isArray(questionnaireData.personalityTraits) ? questionnaireData.personalityTraits.join(', ') : questionnaireData.personalityTraits || 'Not specified'}
    - Distress Level: ${questionnaireData.distressLevel || 'Not specified'} (on a scale of 1-10)
    - Previous Therapy Experience: ${questionnaireData.previousTherapy || 'Not specified'}
    - Preferred Therapy Approach: ${questionnaireData.therapyApproach || 'Not specified'}
    - Additional Comments: ${questionnaireData.comments || 'None provided'}

    AVAILABLE THERAPIST PROFILES: ${therapistProfiles}

    Please analyze the client's needs and recommend a good therapist match. ONLY recommend a therapist who is in the same location as the client's location. Respond ONLY with a JSON object in this exact format:
    {
        "recommendation": {
            "therapistName": "[Full name of recommended therapist]",
            "therapistEmail": "[Email address of recommended therapist]",
            "therapistPhone": "[Phone number of recommended therapist]",
            "therapistProfile": "[Profile link of recommended therapist]",
            "matchScore": [number between 1-100],
            "reasoning": "[A couple sentences explaining why this therapist is a good match]"
        }
    }

    Consider factors like:
    - Therapist specializations matching client's primary concerns
    - Personality compatibility based on client's self-described traits
    - Therapy approach preferences
    - Client's distress level and urgency of care
    - Client's previous therapy experience
    - Session type preference (in-person vs virtual)

    Choose ONE therapist and provide a clear, professional recommendation.`;
}

/**
 * Invoke Bedrock model using AWS SDK v3
 * @param {string} modelId - The Bedrock model ID to invoke
 * @param {Object} requestBody - Request body for the model
 * @returns {Promise<Object>} Parsed response from Bedrock
 */
const invokeBedrockModel = async (modelId, requestBody) => {
    const command = new InvokeModelCommand({
        modelId: modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody)
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody;
}

/**
 * Call OpenAI model via Bedrock
 * @param {string} modelId - OpenAI model ID
 * @param {string} prompt - Prompt to send to the model
 * @returns {Promise<string>} Text output from the model
 */
const useOpenAI = async (modelId, prompt) => {
    const requestBody = {
        messages: [
            {
                role: "user",
                content: prompt
            }
        ],
        max_completion_tokens: 1000,
        temperature: 0.3
    };

    const responseBody = await invokeBedrockModel(modelId, requestBody);
    const outputText = responseBody.choices[0].message.content;
    console.log('LLM output:', outputText);

    return outputText;
}

/**
 * Call Claude model via Bedrock
 * @param {string} modelId - Claude model ID
 * @param {string} prompt - Prompt to send to the model
 * @returns {Promise<string>} Text output from the model
 */
const useClaude = async (modelId, prompt) => {
    const requestBody = {
        anthropic_version: "bedrock-2023-05-31",
        messages: [
            {
                role: "user",
                content: prompt
            }
        ],
        max_tokens: 1000,
        temperature: 0.3
    };

    const responseBody = await invokeBedrockModel(modelId, requestBody);
    const outputText = responseBody.content[0].text;
    console.log('LLM output:', outputText);

    return outputText;
}

/**
 * @typedef {Object} TherapistRecommendation
 * @property {string} therapistName - Full name of recommended therapist
 * @property {number} matchScore - Match score between 1-100
 * @property {string} reasoning - Explanation of why this therapist is a good match
 */

/**
 * Get therapist recommendation from LLM
 * @param {string} prompt - Formatted prompt with questionnaire data and therapist profiles
 * @returns {Promise<{recommendation: TherapistRecommendation}>} Therapist recommendation object
 */
const getTherapistRecommendation = async (prompt) => {
    try {
        const outputText = await useOpenAI('openai.gpt-oss-20b-1:0', prompt);
        // const outputText = await useClaude('anthropic.claude-3-5-haiku-20241022-v1:0', prompt);

        // Try to parse JSON from the response
        const jsonMatch = outputText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        } else {
            throw new Error('Could not parse JSON from LLM response');
        }
    } catch (error) {
        console.error('Error calling Bedrock:', error);
        // Fallback recommendation
        return {
            recommendation: {
                therapistName: "Oops! Something went wrong.",
                matchScore: 0,
                reasoning: "There was an error processing your recommendation - please contact us for a personalized match."
            }
        };
    }
}

/**
 * AWS Lambda handler for therapist matching
 * @param {Object} event - API Gateway event object
 * @param {string} event.body - JSON string containing questionnaire data
 * @param {string} event.httpMethod - HTTP method (POST or OPTIONS)
 * @returns {Promise<Object>} API Gateway response object
 */
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://matcher.frogpointtherapy.com',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Request body is required',
                    timestamp: new Date().toISOString(),
                }),
            };
        }

        const questionnaireData = JSON.parse(event.body);

        // Record user data to Google Sheets asynchronously
        recordUserData(questionnaireData).catch(error => {
            console.error('Error recording user data to Google Sheets:', error);
        });
        
        // Log the questionnaire data for processing
        console.log("Questionnaire Data:", JSON.stringify(questionnaireData, null, 2));
        
        // Load therapist profiles
        const therapistProfiles = loadTherapistProfiles();
        
        // Create prompt for LLM
        const prompt = createMatchingPrompt(questionnaireData, therapistProfiles);
        console.log('Generated prompt:', prompt);
        
        // Get recommendation from Bedrock
        const bedrockResponse = await getTherapistRecommendation(prompt);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Questionnaire processed successfully',
                timestamp: new Date().toISOString(),
                clientName: questionnaireData.name,
                therapistRecommendation: bedrockResponse.recommendation
            }),
        };
    } catch (error) {
        console.error("Error processing questionnaire:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error processing your questionnaire',
                timestamp: new Date().toISOString(),
            }),
        };
    }
};