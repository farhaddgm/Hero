/**
 * Canonical Advisor facade.
 *
 * `form-suggestions` remains a compatibility name for existing clients and
 * the versioned external-spend capability. New application code should import
 * this facade and use Advisor terminology; no route, authorization snapshot or
 * stored event is silently rewritten.
 */
import {
  FORM_PROVIDER_SUGGESTIONS_SCHEMA,
  FORM_SUGGESTIONS_VERSION,
  FORM_SUGGESTION_INITIAL_SUGGESTIONS,
  FORM_SUGGESTION_MAX_DOCUMENT_DRAFT_CHARACTERS,
  FORM_SUGGESTION_MAX_FIELDS,
  FORM_SUGGESTION_MAX_PROVIDER_SUGGESTIONS,
  FORM_SUGGESTION_MAX_REFINEMENTS,
  FORM_SUGGESTION_MAX_SUGGESTIONS,
  FormSuggestionsError,
  createFormSuggestions,
  createProviderFormSuggestions,
  prepareFormSuggestionRefinement,
  prepareFormSuggestionRequest
} from "./form-suggestions.mjs";

export const HERO_ADVISOR_VERSION = FORM_SUGGESTIONS_VERSION;
export const HERO_ADVISOR_PROVIDER_SCHEMA = FORM_PROVIDER_SUGGESTIONS_SCHEMA;
export const HERO_ADVISOR_INITIAL_PROPOSALS = FORM_SUGGESTION_INITIAL_SUGGESTIONS;
export const HERO_ADVISOR_MAX_PROPOSALS = FORM_SUGGESTION_MAX_SUGGESTIONS;

export const AdvisorError = FormSuggestionsError;
export const prepareAdvisorRequest = prepareFormSuggestionRequest;
export const prepareAdvisorRefinement = prepareFormSuggestionRefinement;
export const createAdvisorProposals = createFormSuggestions;
export const createProviderAdvisorProposals = createProviderFormSuggestions;

// Legacy exports keep source and API compatibility during the versioned rename.
export {
  FORM_PROVIDER_SUGGESTIONS_SCHEMA,
  FORM_SUGGESTIONS_VERSION,
  FORM_SUGGESTION_INITIAL_SUGGESTIONS,
  FORM_SUGGESTION_MAX_DOCUMENT_DRAFT_CHARACTERS,
  FORM_SUGGESTION_MAX_FIELDS,
  FORM_SUGGESTION_MAX_PROVIDER_SUGGESTIONS,
  FORM_SUGGESTION_MAX_REFINEMENTS,
  FORM_SUGGESTION_MAX_SUGGESTIONS,
  FormSuggestionsError,
  createFormSuggestions,
  createProviderFormSuggestions,
  prepareFormSuggestionRefinement,
  prepareFormSuggestionRequest
};
