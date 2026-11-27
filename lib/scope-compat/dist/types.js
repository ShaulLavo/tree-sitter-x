export const FONT_STYLE_ITALIC = 1;
export const FONT_STYLE_BOLD = 2;
export const FONT_STYLE_UNDERLINE = 4;
export const FONT_STYLE_STRIKETHROUGH = 8;
export class ScopeCompatError extends Error {
    status;
    detail;
    value;
    reason;
    constructor(message, status, detail, value = 0) {
        super(message);
        this.name = 'ScopeCompatError';
        this.status = status;
        this.detail = detail;
        this.value = value;
        this.reason = status === 1 ? 'unsupported' : status === 2 ? 'budget' : status === 4 ? 'no-memory' : 'invalid';
    }
}
