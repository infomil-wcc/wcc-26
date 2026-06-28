/**
 * Fetches the total count of registered users from Directus assigned to a specific role.
 * @param {string} directusUrl - The Directus Base URL.
 * @param {string} adminToken - The Directus administrative bearer token.
 * @param {string} roleId - The role ID to filter users by.
 * @returns {Promise<number>} Total number of users found.
 */
export async function getRegisteredUserCount(directusUrl, adminToken, roleId) {
    if (!directusUrl || !adminToken || !roleId) {
        throw new Error('MISSING_CONFIGURATION');
    }

    const response = await fetch(`${directusUrl}/users?filter[role]=${roleId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        }
    });

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(data?.errors?.[0]?.message || 'Directus API Error');
        error.status = response.status;
        error.details = data;
        throw error;
    }

    return data.data ? data.data.length : 0;
}

/**
 * Registers a new user in Directus and creates their initial registration ranking entry.
 * @param {Object} userData - User registration info (email, password, first_name, last_name).
 * @param {Object} config - Configuration objects containing directusUrl, adminToken, and roleId.
 * @returns {Promise<Object>} The registered user data object.
 */
export async function registerNewUser(userData, config) {
    const { email, password, first_name, last_name } = userData;
    const { directusUrl, adminToken, roleId } = config;

    if (!directusUrl || !adminToken || !roleId) {
        throw new Error('MISSING_CONFIGURATION');
    }

    // 1. Create the user profile in Directus
    const response = await fetch(`${directusUrl}/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            email,
            password,
            first_name,
            last_name,
            status: 'active',
            role: roleId
        })
    });

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(data?.errors?.[0]?.message || 'Failed to create user profile');
        error.status = response.status;
        error.details = data;
        throw error;
    }

    // 2. Post to registration_ranking collection (Non-blocking step)
    try {
        await fetch(`${directusUrl}/items/registration_ranking`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                trigramme: first_name,
                status: 'published'
            })
        });
    } catch (rankingError) {
        // Logged but intentionally absorbed so user creation isn't aborted over secondary telemetry
        console.error('⚠️ Error posting to registration_ranking side table:', rankingError);
    }

    return data.data;
}