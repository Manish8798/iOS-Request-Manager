import {action, computed, observable, toJS, makeObservable} from 'mobx';
import Config from 'react-native-config';
import {captureException} from '@sentry/react-native';

import Journal from './Journal';
import {Toast} from '../../utils/helper';
import HomeStore from '../../stores/HomeStore';
import TokenStore from '../../stores/TokenStore';
import EventBus from '../../EventBus';
import Mood from './Mood';

class MoodTracker extends Journal {
  selectedMoodId = null;
  attachedTo = '';
  activeMood = null;
  moods = [];
  postMoodSavedId = null;

  constructor(
    noteId,
    userNoteId,
    type,
    journalEntry,
    moods,
    isNewJournaling,
    createdAt,
    title,
    isDone,
    classification,
    selectedMoodId,
    attachedTo,
    voiceNote,
    voiceNoteDuration,
  ) {
    super(
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
    );
    this.moods = moods;
    this.attachedTo = attachedTo;
    this.selectedMoodId = selectedMoodId;
    this.placeholder = 'I feel this way because...';
    this.hasUserInteracted = true;
    this.userTipPopupShown = false;
    this.hasStartJournalPopupClosed = true;
    this.voiceNote = voiceNote;
    this.tempVoiceNote = voiceNote;
    this.voiceNoteDuration = voiceNoteDuration;
    this.tempVoiceNoteDuration = voiceNoteDuration;

    makeObservable(this, {
      activeMood: observable,
      moods: observable,
      attachedTo: observable,
      selectedMoodId: observable,
      postMoodSavedId: observable,
      addMoodTrackerPrompt: action,
      setActiveMood: action,
      selectMood: action,
      fetchSavedMood: action,
      postMoodData: action,
    });
    this.selectMood(this.selectedMoodId, attachedTo);
    if (userNoteId) {
      // means user is editing existing mood entry
      this.fetchSavedMood();
    } else {
      // means user is creating a fresh mood entry
      this.addMoodTrackerPrompt();
    }
  }

  isEmpty() {
    const isBaseEmpty = super.isEmpty();
    if (isBaseEmpty && !this.activeMood) {
      return true;
    }
    return false;
  }

  get displayPrompt() {
    return `${this.journalEntry?.english[0]?.prompt} ${this.journalEntry?.english[0]?.moodName}`;
  }

  selectMood = (moodId, attachedTo) => {
    let emojiId = parseInt(moodId);
    let selectedMood = this.moods.find(mood => mood.id === emojiId);
    // this.setActiveMood(selectedMood);
    this.activeMood = selectedMood;
    if (selectedMood) {
      // mood tracker
      this.journalEntry.english[0].moodName = `${this.activeMood?.emoji_name}`;
    } else {
      this.journalEntry.english[0].moodName = '';
    }

    EventBus.userSelectedMoodInJournal(selectedMood?.emoji_name, attachedTo);
  };

  deepCopy() {
    return new MoodTracker(
      this.noteId,
      this.userNoteId,
      this.type,
      JSON.parse(JSON.stringify(this.journalEntry)),
      this.moods,
      this.isNewJournaling,
      this.createdAt,
      this.title,
      this.isDone,
      this.classification,
      this.activeMood?.id,
      this.attachedTo,
      this.voiceNote,
      this.voiceNoteDuration,
    );
  }

  setActiveMood(selectedMood) {
    this.activeMood = selectedMood;
  }

  /**
   * Add fresh mood tracker prompt in case of new mood entry
   */
  addMoodTrackerPrompt() {
    this.journalEntry.english[0] = {
      ...this.journalEntry.english[0],
      type: Journal.MOOD_TRACKER,
    };

    let existingTemplate = toJS(this.journalEntry);
    this.journalEntry = existingTemplate;
  }

  isJournalEntryMoodTracker() {
    const englishArray = this.journalEntry?.english;
    if (Array.isArray(englishArray) && englishArray?.length > 0) {
      const firstElement = englishArray[0];
      return (
        firstElement &&
        typeof firstElement === 'object' &&
        firstElement['type'] === Journal.MOOD_TRACKER
      );
    }
    return false;
  }

  async fetchSavedMood() {
    let emojiId = null;
    await fetch(
      `${Config.JOURNAL_BASE_URL}usernote_emoji/${this.userNoteId}/`,
      {
        method: 'GET',
        crossorigin: true,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        headers: {
          'Content-type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${TokenStore.accessToken}`,
        },
      },
    )
      .then(async response => {
        let newFormat = await response.json();
        this.postMoodSavedId = newFormat?.id;
        emojiId = newFormat?.emoji_id;
        this.selectMood(emojiId, this.attachedTo);
      })
      .catch(err => {
        captureException(err);
        console.error('usernote_emoji Response Error', err);
        try {
          if (err.response) {
            const {status, data} = err.response;
            switch (status) {
              case 401:
                TokenStore.getRefreshToken({
                  className: this,
                  functionName: 'fetchSavedMood',
                });
                break;

              default:
                break;
            }
          }
        } catch (error) {
          captureException(error);
          console.error('tryCatchError fetchSavedMood', error);
        }
      });

    return emojiId;
  }

  async _createJournal() {
    try {
      let newMoodObj;
      const res = await super._createJournal();

      if (this.activeMood) {
        newMoodObj = await this.postMoodData();
      }

      return {...res, savedMoodEntry: newMoodObj};
    } catch (err) {
      console.error('MoodTracker Save Journal', err);
    }
  }

  async _updateJournal() {
    try {
      let newMoodObj;
      let res = await super._updateJournal();

      if (this.activeMood) {
        newMoodObj = await this.updateMoodData();
      }

      return {...res, savedMoodEntry: newMoodObj};
    } catch (err) {
      console.error('MoodTracker Update Journal', err);
    }
  }

  isRewardable() {
    return true;
  }

  /**
   * When user saves note, this method saves the selected mood in a separate table.
   *
   */
  async postMoodData() {
    let params = {
      emoji: this.activeMood?.id,
      note: 29,
      usernote: this.userNoteId,
    };
    let newParams = JSON.stringify(params);
    let newFormat = null;

    await fetch(`${Config.JOURNAL_BASE_URL}useremojis/`, {
      method: 'POST',
      crossorigin: true,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      headers: {
        'Content-type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${TokenStore.accessToken}`,
      },
      body: newParams,
    })
      .then(async response => {
        newFormat = await response.json();
        this.postMoodSavedId = newFormat?.id;

        HomeStore.updateUserActivity({
          content_id: this.noteId,
          content_type: 'new_journal',
          duration: '0',
          newContent: newFormat.content,
        });
      })
      .catch(e => {
        captureException(e);
        console.error('Emoji Response Error', e);

        try {
          if (e.response) {
            const {status, data} = e.response;
            switch (status) {
              case 401:
                TokenStore.getRefreshToken({
                  className: this,
                  functionName: 'postMoodData',
                });
                break;

              default:
                break;
            }
          }
        } catch (error) {
          captureException(error);
          console.error('tryCatchError postMoodData', error);
        }
      });
    // create a new mood.js object and save in MoodChart
    return new Mood(
      this.userNoteId,
      newFormat?.id,
      newFormat?.emoji_name,
      // newFormat?.emoji,
      this.activeMood?.picture,
      newFormat?.created_at,
    );
  }

  async updateMoodData() {
    let params = {
      emoji: this.activeMood?.id,
      note: 29,
      usernote: this.userNoteId,
    };

    let newParams = JSON.stringify(params);
    let newFormat = null;

    await fetch(
      `${Config.JOURNAL_BASE_URL}useremojis/${this.postMoodSavedId}/`,
      {
        method: 'PUT',
        crossorigin: true,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        headers: {
          'Content-type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${TokenStore.accessToken}`,
        },
        body: newParams,
      },
    )
      .then(async response => {
        newFormat = await response.json();
      })
      .catch(e => {
        captureException(e);
        console.error('Update Emoji Response Error', e);

        try {
          if (e.response) {
            const {status, data} = e.response;
            switch (status) {
              case 401:
                TokenStore.getRefreshToken({
                  className: this,
                  functionName: 'updateMoodData',
                });
                break;

              default:
                break;
            }
          }
        } catch (error) {
          captureException(error);
          console.error('tryCatchError updateMoodData', error);
        }
      });

    return new Mood(
      this.userNoteId,
      newFormat?.id,
      newFormat?.emoji_name,
      // newFormat?.emoji,
      this.activeMood?.picture,
      newFormat?.created_at,
    );
  }
}

export default MoodTracker;
