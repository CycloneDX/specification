
import { DATA_KEYWORDS } from './json-schema-spec.js';

const DATA_KEYWORDS_SET = Object.freeze(new Set(DATA_KEYWORDS));

/**
 * Remove $comment in place - except from root
 */
export function dropCommentsExceptRoot(schema) {
    if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
        throw new Error('expected a schema');
    }
    for (const [k, v] of Object.entries(schema)) {
        if (DATA_KEYWORDS_SET.has(k)) { continue; }
        dropComments(v);
    }
}

/**
 * Remove $comment in place
 */
function dropComments(schema) {
    if (typeof schema !== 'object' || schema === null) {
        return;
    }
    if (Array.isArray(schema)) {
        schema.forEach(dropComments);
        return;
    }
    delete schema.$comment;
    for (const [k, v] of Object.entries(schema)) {
        if (DATA_KEYWORDS_SET.has(k)) { continue; }
        dropComments(v);
    }
}
