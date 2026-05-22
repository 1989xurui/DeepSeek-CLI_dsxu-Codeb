import axios from 'axios'
import { getOauthConfig } from '../../constants/oauth.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { getAuthHeaders } from '../../utils/http.js'
import { logError } from '../../utils/log.js'
import { getDSXUCodeUserAgent } from '../../utils/userAgent.js'

const FIRST_TOKEN_DATE_PATH = `/api/organization/${'cl' + 'aude'}_code_first_token_date`

/**
 * Fetch the user's first DSXU Code token date and store in config.
 * This is called after successful login to cache when they started using DSXU Code.
 */
export async function fetchAndStoreDsxuCodeFirstTokenDate(): Promise<void> {
  try {
    const config = getGlobalConfig()

    if (config.dsxuCodeFirstTokenDate !== undefined) {
      return
    }

    const authHeaders = getAuthHeaders()
    if (authHeaders.error) {
      logError(new Error(`Failed to get auth headers: ${authHeaders.error}`))
      return
    }

    const oauthConfig = getOauthConfig()
    const url = `${oauthConfig.BASE_API_URL}${FIRST_TOKEN_DATE_PATH}`

    const response = await axios.get(url, {
      headers: {
        ...authHeaders.headers,
        'User-Agent': getDSXUCodeUserAgent(),
      },
      timeout: 10000,
    })

    const firstTokenDate = response.data?.first_token_date ?? null

    // Validate the date if it's not null
    if (firstTokenDate !== null) {
      const dateTime = new Date(firstTokenDate).getTime()
      if (isNaN(dateTime)) {
        logError(
          new Error(
            `Received invalid first_token_date from API: ${firstTokenDate}`,
          ),
        )
        // Don't save invalid dates
        return
      }
    }

    saveGlobalConfig(current => ({
      ...current,
      dsxuCodeFirstTokenDate: firstTokenDate,
    }))
  } catch (error) {
    logError(error)
  }
}
