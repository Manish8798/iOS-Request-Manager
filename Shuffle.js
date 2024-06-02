import AsyncStorage from '@react-native-async-storage/async-storage';
import {captureException} from '@sentry/react-native';
import Config from 'react-native-config';
import {action, computed, observable, toJS, makeObservable} from 'mobx';

import Journal from './Journal';
import {appAnalytics, trackMixpanelEvent} from '../../utils/helper';
import TokenStore from '../../stores/TokenStore';
import AppStore from '../../stores/AppStore';
import NewJournalingStore from '../../stores/NewJournalingStore';

class Shuffle extends Journal {
  static DEFAULT_CATEGORY = {title: 'all', id: 0, index: 0};
  journalingCategories = [];
  categoriesLoading = false;
  selectedJournalingCategory = Shuffle.DEFAULT_CATEGORY;
  isCategoryModalVisible = false;
  initialPrompt = null;
  isAnytimeJournal = false;

  constructor(
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
      isAnytimeJournal,
    );

    this.getUserJournalPopup();
    this.hasStartJournalPopupClosed = false;
    this.hasUserInteracted = false;
    this.initialPrompt = initialPrompt;
    this.voiceNote = voiceNote;
    this.tempVoiceNote = voiceNote;
    this.voiceNoteDuration = voiceNoteDuration;
    this.tempVoiceNoteDuration = voiceNoteDuration;
    this.isAnytimeJournal = isAnytimeJournal;

    makeObservable(this, {
      journalingCategories: observable,
      categoriesLoading: observable,
      selectedJournalingCategory: observable,
      isCategoryModalVisible: observable,
      fetchJournalingCategories: action,
      onSaveCategoryChanges: action,
      toggleCategoryModal: action,
      clearExistingPrompt: action,
      shufflePrompt: action,
      setInitialPrompt: action,
      getUserJournalPopup: action,
    });

    if (!this.isEditMode) {
      this.clearExistingPrompt();
      this.setInitialPrompt(initialPrompt);
    }

    this.fetchJournalingCategories();
  }

  // deepCopy() {
  //   return new Shuffle(
  //     this.noteId,
  //     this.userNoteId,
  //     this.type,
  //     JSON.parse(JSON.stringify(this.journalEntry)),
  //     this.isNewJournaling,
  //     this.createdAt,
  //     this.title,
  //     this.isDone,
  //     this.classification,
  //     this.initialPrompt,
  //     this.voiceNote,
  //     this.voiceNoteDuration,
  //   );
  // }

  /**
   * Preset the shuffle prompt that's initially loaded in case of new journal entry, so that user doesn't see the flash of shuffle initially.
   * @param {*} initialPrompt
   */
  setInitialPrompt(initialPrompt) {
    this.journalEntry.english[0] = {
      ...this.journalEntry.english[0],
      prompt: initialPrompt.question_text,
      helper_text: initialPrompt.helper_text,
      id: initialPrompt.id,
      shufflePrompt: true,
      journalprompt: initialPrompt.id,
    };
  }

  clearExistingPrompt() {
    this.journalEntry.english[0] = {
      ...this.journalEntry.english[0],
      prompt: '',
    };
  }

  async getUserJournalPopup() {
    await AsyncStorage.getItem('popupShown').then(value => {
      if (!value && !this.userNoteId) {
        // If not shown, set the state to show the popup
        this.userTipPopupShown = true;
        // Update AsyncStorage to mark that the popup has been shown
        AsyncStorage.setItem('popupShown', 'true');
      } else {
        this.userTipPopupShown = false;
      }
    });
  }

  async fetchJournalingCategories() {
    this.categoriesLoading = true;
    await fetch(`${Config.JOURNAL_BASE_URL}journal_problems/`, {
      method: 'GET',
      crossorigin: true,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      headers: {
        'Content-type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${TokenStore.accessToken}`,
      },
    })
      .then(async response => {
        if (response.ok) {
          const responseJSON = await response.json();
          const categoriesArray = responseJSON?.problems || [];
          this.journalingCategories = [
            {title: 'All', id: 0},
            ...categoriesArray,
          ];
          this.categoriesLoading = false;
        } else {
          if (response.status === 401) {
            TokenStore.getRefreshToken({
              className: this,
              functionName: 'fetchJournalingCategories',
            });
          } else {
            captureException(response.statusText);
          }
        }
      })
      .catch(error => {
        captureException(error);
        console.error('Error Fetching Journaling Categories', error);
        this.categoriesLoading = false;

        try {
          if (error.response) {
            const {status, data} = error.response;
            switch (status) {
              case 401:
                TokenStore.getRefreshToken({
                  className: this,
                  functionName: 'fetchJournalingCategories',
                });
                break;

              default:
                break;
            }
          }
        } catch (error) {
          captureException(error);
          console.error('tryCatchError shuffle prompt', error);
        }
      });
  }

  async shufflePrompt(selectedCatId) {
    this.hasUserInteracted = true;
    const selectedCategoryId =
      selectedCatId || this.selectedJournalingCategory?.id;

    const newPrompt = await NewJournalingStore.fetchShufflePrompt(
      selectedCategoryId,
    );

    this.journalEntry.english[0] = {
      ...this.journalEntry.english[0],
      prompt: newPrompt.question_text,
      helper_text: newPrompt.helper_text,
      id: newPrompt.id,
      shufflePrompt: true,
      journalprompt: newPrompt.id,
    };

    const eventParams = {
      developer_id: AppStore.developerId,
    };

    appAnalytics('journal_prompt_shuffle', eventParams);
    trackMixpanelEvent('journal_prompt_shuffle', eventParams);
  }

  async onSaveCategoryChanges(selectedCategory) {
    this.hasUserInteracted = true;
    if (selectedCategory.id !== 0) {
      this.shufflePrompt(selectedCategory.id);
    }
    this.selectedJournalingCategory = selectedCategory;
    this.toggleCategoryModal(false);
  }

  toggleCategoryModal = isVisible => {
    this.isCategoryModalVisible = isVisible;
  };
}

export default Shuffle;
