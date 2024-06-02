import NewJournalingStore from '../../stores/NewJournalingStore';
import Journal from './Journal';
import MoodTracker from './MoodTracker';
import Shuffle from './Shuffle';

/**
 * Converts a raw javascript object into a models/Journal object (i.e. Shuffle or MoodTracker or Basic Journaling objects).
 *
 * @param {number} noteId , the original template ID
 * @param {number} userNoteId , id of the note/journal entry done by the user
 * @param {string} type , shuffle or mood tracker or basic journaling
 * @param {string} journalEntry , the entry/journal written by the user
 * @param {number} selectedMoodId , in case of mood tracker the id of the emoji, else null
 * @param {boolean} isNewJournaling , to differentiate between IC based journaling and new Note based Journaling
 * @param {timeStamp} createdAt , null in case of fresh Journal entry, present in case of existing journal entry being edited.
 * @param {string} title , the title to be shown in case of Journal section cards.
 * @param {boolean} isDone , true if user has journaled for the day, else false.
 * @param {string} classification , premium or non-premium content.
 *
 * @returns the created Journal objects of the appropriate type (Journal or MoodTracker or Shuffle)
 */
export const createJournalModel = async (
  noteId,
  userNoteId,
  type,
  journalEntry,
  selectedMoodId,
  isNewJournaling,
  createdAt,
  title,
  isDone,
  classification,
  voiceNote,
  voiceNoteDuration,
  initialPrompt,
  isAnytimeJournal,
) => {
  switch (type) {
    case Journal.SHUFFLE:
      let shuffleObj = new Shuffle(
        noteId,
        userNoteId,
        type,
        journalEntry,
        isNewJournaling,
        createdAt,
        title,
        isDone,
        classification,
        initialPrompt,
        voiceNote,
        voiceNoteDuration,
        isAnytimeJournal,
      );
      return shuffleObj;

    case Journal.MOOD_TRACKER:
      let moodTrackerObj = new MoodTracker(
        noteId,
        userNoteId,
        type,
        journalEntry,
        NewJournalingStore.moods,
        isNewJournaling,
        createdAt,
        title,
        isDone,
        classification,
        selectedMoodId,
        'TodayCard',
        voiceNote,
        voiceNoteDuration,
        isAnytimeJournal,
      );
      return moodTrackerObj;

    case Journal.JOURNAL:
      let journalObj = new Journal(
        noteId,
        userNoteId,
        type,
        journalEntry,
        isNewJournaling,
        createdAt,
        title,
        isDone,
        classification,
        voiceNote,
        voiceNoteDuration,
        isAnytimeJournal,
      );
      return journalObj;
  }
};

export const createMoodTrackerObj = async selectedMoodId => {
  const journalObj = await createJournalModel(
    29,
    null,
    'mood_tracker',
    {english: [{prompt: 'today, I feel'}]},
    selectedMoodId ? selectedMoodId : NewJournalingStore.moods,
    true,
    null,
    'track your mood',
    null,
    'free',
    null,
    0,
  );
  return journalObj;
};

export const createShuffleObj = async () => {
  const journalObj = await createJournalModel(
    31,
    null,
    'shuffle',
    {english: [{prompt: 'What do you want to vent about today?'}]},
    NewJournalingStore.moods,
    true,
    null,
    `today's journaling`,
    null,
    'free',
    null,
    0,
  );
  return journalObj;
};
