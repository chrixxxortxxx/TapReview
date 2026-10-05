import { IS_DEMO } from '../config'
import * as demo from './demo'
import * as live from './supabase'

/** Single data API used by the whole app. Demo mode when Supabase env vars are missing. */
export const api = IS_DEMO ? demo : live
