import {JSON_SCHEMA_RE} from './common.js'

/**
 * CycloneDX specifics.
 */


const CDX_MODULE_NAME_RE = Object.freeze(/^cyclonedx-(.+)-\d\.\d.schema.json$/);


/**
 * Make a module name from a file name.
 *
 * If  file matches `CDX_MODULE_NAME_RE`, then derive module name from it,
 * otherwise tit is the JSON schema file's base name.
 *
 * @param {string} s
 * @return {string}
 */
export function makeModuleName(s) {
    const match = s.match(CDX_MODULE_NAME_RE);
    return match === null
        ? s.replace(JSON_SCHEMA_RE, '')
        : match[1];
}
