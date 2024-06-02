import {action, computed, observable, toJS, makeObservable} from 'mobx';
import Config from 'react-native-config';
import BackgroundActions from 'react-native-background-actions';
import {DeviceEventEmitter} from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';
import moment from 'moment';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';

import EventBus from '../../EventBus';
import TokenStore from '../../stores/TokenStore';
import HomeStore from '../../stores/HomeStore';
import AppStore from '../../stores/AppStore';
import {navigationRef} from '../../RootNavigation';
import {
  appAnalytics,
  trackMixpanelEvent,
  Toast,
  getMonthString,
} from '../../utils/helper';
import {postData} from '../../utils/api';
import {captureException, captureMessage} from '@sentry/react-native';
import TodayStore from '../../stores/TodayStore';
import NewJournalingStore from '../../stores/NewJournalingStore';

class Journal {
  static JOURNAL = 'journal';
  static SHUFFLE = 'shuffle';
  static MOOD_TRACKER = 'mood_tracker';
  static MOOD_TRACKER_BACKWARDS_COMP = 'mood-tracker'; // discontinued from 22-01-24, supports entries prior to that.

  noteId = null; //template id
  userNoteId = null; //edit journal
  type = null;
  journalEntry = {};
  loading = false;
  deletedImageIds = [];
  isNewJournaling = true;
  createdAt = null;
  title = null;
  isDone = false;
  classification = null;
  placeholder = 'write your thoughts...';
  hasUserInteracted = false;
  userTipPopupShown = false;
  hasStartJournalPopupClosed = false;
  voiceNote = null;
  voiceNoteDuration = 0;
  voiceNoteName = null;
  isVoiceRecorderModalVisible = false;
  tempVoiceNote = null;
  tempVoiceNoteDuration = 0;
  wordsCountData = {};
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
    voiceNote,
    voiceNoteDuration,
    isAnytimeJournal,
  ) {
    this.noteId = noteId;
    this.userNoteId = userNoteId;
    this.type = type;
    this.journalEntry = journalEntry;
    this.isNewJournaling = isNewJournaling;
    this.createdAt = createdAt;
    this.title = title;
    this.isDone = isDone;
    this.classification = classification;
    this.hasUserInteracted = true;
    this.hasStartJournalPopupClosed = true;
    this.userTipPopupShown = false;
    this.voiceNote = voiceNote;
    this.tempVoiceNote = voiceNote;
    this.voiceNoteDuration = voiceNoteDuration;
    this.tempVoiceNoteDuration = voiceNoteDuration;
    this.isAnytimeJournal = isAnytimeJournal;

    makeObservable(this, {
      noteId: observable,
      userNoteId: observable,
      type: observable,
      journalEntry: observable,
      loading: observable,
      deletedImageIds: observable,
      isNewJournaling: observable,
      createdAt: observable,
      title: observable,
      isDone: observable,
      classification: observable,
      placeholder: observable,
      hasUserInteracted: observable,
      userTipPopupShown: observable,
      hasStartJournalPopupClosed: observable,
      voiceNote: observable,
      voiceNoteDuration: observable,
      voiceNoteName: observable,
      isVoiceRecorderModalVisible: observable,
      tempVoiceNote: observable,
      tempVoiceNoteDuration: observable,
      wordsCountData: observable,
      isAnytimeJournal: observable,
      isEmpty: action,
      saveJournal: action,
      _updateJournal: action,
      _createJournal: action,
      isRewardable: action,
      updateText: action,
      cameraHandler: action,
      galleryHandler: action,
      tempDeleteImage: action,
      deleteImageObjectById: action,
      saveImageInBackground: action,
      saveImageHandler: action,
      saveVoiceInBackground: action,
      saveVoiceHandler: action,
      getImage: action,
      deepCopy: action,
      closeJournalingPopup: action,
      getDates: action,
      isEditMode: computed,
      displayPrompt: computed,
      text: computed,
      micHandler: action,
      deleteVoiceRecording: action,
      toggleVoiceRecorderModal: action,
      hasVoiceNoteChanged: action,
      getJournalWordsCount: action,
    });
    this.normalizeTemplate();
  }

  hasVoiceNoteChanged() {
    if (this.userNoteId) {
      return this.hasUserInteracted;
    } else {
      if (this.hasUserInteracted && this.tempVoiceNote) {
        return true;
      } else {
        return false;
      }
    }
  }

  isEmpty() {
    const isAnyValuePresent =
      this.journalEntry?.english?.some(
        prompt =>
          prompt.text &&
          Array.isArray(prompt.text) &&
          prompt.text.length > 0 &&
          (prompt.text[0] || prompt.text[1]?.image),
      ) || this.hasVoiceNoteChanged();
    return isAnyValuePresent ? false : true;
  }

  get isEditMode() {
    return this.userNoteId ? true : false;
  }

  get displayPrompt() {
    return this.journalEntry?.english[0]?.prompt;
  }

  get text() {
    // Check if the variable is an array
    if (!Array.isArray(this.journalEntry?.english[0]?.text)) {
      return this.journalEntry?.english[0]?.text;
    } else {
      const nonEmptyElement = this.journalEntry?.english[0]?.text?.some(
        item => item && typeof item === 'string' && item.trim() !== '',
      );
      if (nonEmptyElement) {
        return this.journalEntry?.english[0]?.text[0];
      } else return '--';
    }
  }

  getImage() {
    return this.journalEntry.english[0].text?.find?.(
      item => typeof item === 'object' && item.image,
    );
  }

  getDates(type) {
    let currentDate = moment();
    // Parse the date string using moment
    let date = moment(this.createdAt);
    switch (type) {
      case 'month':
        let monthOnly = getMonthString(date.month());
        return monthOnly;
        break;

      case 'formattedDate':
        // Parse the date string using moment
        let formattedDate = date.format('D'); // Day of the month (e.g., 5)
        return formattedDate;
        break;

      case 'day-date':
        if (this.userNoteId) {
          let formattedDate = date.format('D'); // Day of the month (e.g., 5)
          return formattedDate;
        } else {
          return currentDate.date();
        }
        break;

      case 'month-year':
        if (this.userNoteId) {
          return `${moment.utc(this.createdAt).format('MMMM')} ${moment
            .utc(this.createdAt)
            .format('yyyy')}`;
        } else {
          return `${currentDate.format('MMMM')} ${currentDate.format('yyyy')}`;
        }
        break;

      case 'day':
        if (this.userNoteId) {
          return `${moment.utc(this.createdAt).format('dddd')}`;
        } else {
          return `${currentDate.format('dddd')}`;
        }
        break;
    }
  }

  normalizeTemplate() {
    // // Add an event listener for app state changes
    // Check if a fresh template is loaded without text entries, then add dummy entries
    const standardizedNotesTemplate = {...this.journalEntry}; // Create a shallow copy to avoid modifying the original object
    standardizedNotesTemplate.english = this.journalEntry?.english?.map(
      item => {
        if (!item.text) {
          item.text = [''];
        }
        return item;
      },
    );

    this.journalEntry = standardizedNotesTemplate;
  }

  isRewardable() {
    return true;
  }

  closeJournalingPopup() {
    this.hasStartJournalPopupClosed = true;
    this.userTipPopupShown = false;
  }

  deepCopy() {
    return new Journal(
      this.noteId,
      this.userNoteId,
      this.type,
      JSON.parse(JSON.stringify(this.journalEntry)),
      this.isNewJournaling,
      this.createdAt,
      this.title,
      this.isDone,
      this.classification,
      this.voiceNote,
      this.voiceNoteDuration,
      this.isAnytimeJournal,
    );
  }

  updateText(promptIndex, text, dataType) {
    this.hasUserInteracted = true;
    //Re Updating the Old Array Template by creating a new array;

    let englishJournal = Object.values(this.journalEntry)[0]; // extracting english, it can be other langs also, so extracting with index
    let promptBeingEdited = {...englishJournal[promptIndex]}; // extracting prompt being edited

    // Check if the item at the current index is a string (text)
    if (dataType === 'text') {
      promptBeingEdited.text[0] = text; // Update the text value at the specified index
    }
    let updatedValue = Object.values(this.journalEntry)[0]?.splice(
      promptIndex,
      1,
      promptBeingEdited,
    );
  }

  deleteImageObjectById(array, targetId) {
    return array.filter(item => {
      if (
        typeof item === 'object' &&
        item.image &&
        item.image.id === targetId
      ) {
        return false; // Exclude the item with the target ID
      }
      return true; // Include other items
    });
  }

  /**
   * Temporary delete image from journal
   * @param {*} imageId
   */
  tempDeleteImage(imageId) {
    this.hasUserInteracted = true;
    let journalEntryCopy = JSON.parse(JSON.stringify(this.journalEntry));
    let englishJournal = Object.values(journalEntryCopy)[0];
    let firstPrompt = {...englishJournal[0]};

    firstPrompt.text = this.deleteImageObjectById(firstPrompt.text, imageId);

    Object.values(this.journalEntry)[0]?.splice(0, 1, firstPrompt);
    // this.setFields('template', this.template);
    this.deletedImageIds = [...this.deletedImageIds, imageId];

    EventBus.userDeletedImageInJournal();
  }

  cameraHandler() {
    this.hasUserInteracted = true;
    let englishJournal = Object.values(this.journalEntry)[0];
    let firstPrompt = {...englishJournal[0]}; // 0 means first prompt

    ImagePicker.openCamera({
      cropping: true,
    })
      .then(image => {
        let filePath = image.path;

        // Extracting image name
        let imageNameWithExtension = filePath.split('/').pop(); // Get the last part of the path
        let imageName = imageNameWithExtension.split('.')[0]; // Remove the file extension

        // Extracting image type (extension)
        let imageType = imageNameWithExtension.split('.').pop();

        let randomId = Math.floor(Math.random() * 1000) + 1;

        // Add the text and image data to the array
        firstPrompt.text = [
          ...firstPrompt.text,
          {
            image: {
              id: randomId,
              image: image.path,
              name: `${imageName}.${imageType}`,
              type: `image/${imageType}`,
              imageHeight: image.height,
              imageWidth: image.width,
            },
          },
        ];
        Object.values(this.journalEntry)[0]?.splice(0, 1, firstPrompt); // 0 means first prompt
        // this.setFields('template', this.template);
        const events = {
          developer_id: AppStore.developerId,
          source: 'camera',
        };

        appAnalytics('journal_photos_add', events, false);
        trackMixpanelEvent('journal_photos_add', events);
      })
      .catch(error => {
        captureException(error);
        console.error('Camera Error', error);
      });
  }

  galleryHandler() {
    this.hasUserInteracted = true;
    let englishJournal = Object.values(this.journalEntry)[0];
    let firstPrompt = {...englishJournal[0]}; // 0 means first prompt

    ImagePicker.openPicker({
      cropping: true,
    })
      .then(image => {
        let filePath = image.path;

        // Extracting image name
        let imageNameWithExtension = filePath.split('/').pop(); // Get the last part of the path
        let imageName = imageNameWithExtension.split('.')[0]; // Remove the file extension

        // Extracting image type (extension)
        let imageType = imageNameWithExtension.split('.').pop();

        let randomId = Math.floor(Math.random() * 1000) + 1;

        // Add the text and image data to the array
        firstPrompt.text = [
          ...firstPrompt.text,
          {
            image: {
              id: randomId,
              image: image.path,
              name: `${imageName}.${imageType}`,
              type: `image/${imageType}`,
              imageHeight: image.height,
              imageWidth: image.width,
            },
          },
        ];

        Object.values(this.journalEntry)[0]?.splice(0, 1, firstPrompt); // 0 means first prompt
        // this.setFields('template', this.template);
        const events = {
          developer_id: AppStore.developerId,
          source: 'gallery',
        };

        appAnalytics('journal_photos_add', events, false);
        trackMixpanelEvent('journal_photos_add', events);
      })
      .catch(error => {
        captureException(error);
        console.error('Gallery Error', error);
      });
  }

  micHandler(audioPath, recordTime, name) {
    const parts = audioPath.split('/');
    const filename = parts[parts.length - 1];
    this.tempVoiceNote = audioPath;
    this.tempVoiceNoteDuration = recordTime;
    this.voiceNoteName = filename;
    this.hasUserInteracted = true;
    this.isVoiceRecorderModalVisible = false;
  }

  async toggleVoiceRecorderModal(isVisible) {
    const result = await check(PERMISSIONS.ANDROID.RECORD_AUDIO);
    if (result === RESULTS.GRANTED) {
      // Microphone permission is granted, allow recording.
      this.isVoiceRecorderModalVisible = isVisible;
      const events = {
        developer_id: AppStore.developerId,
        source: this.noteId,
      };

      appAnalytics('journal_voice_open', events, false);
      trackMixpanelEvent('journal_voice_open', events);
      return true;
    } else {
      return false;
    }
  }

  deleteVoiceRecording() {
    const events = {
      developer_id: AppStore.developerId,
      note_title: this.noteId,
      audio_id: this.tempVoiceNote,
    };
    this.tempVoiceNote = null;
    this.voiceNoteName = null;
    this.tempVoiceNoteDuration = 0;
    this.hasUserInteracted = true;
    appAnalytics('journal_voice_delete', events, false);
    trackMixpanelEvent('journal_voice_delete', events);
  }

  async saveJournal() {
    if (this.isEmpty()) {
      return {postGoBack: true, showToast: false, reload: false};
    }

    let res;
    const showRewardScreen = await AppStore.shouldShowRewardScreen();

    if (this.userNoteId) {
      res = await this._updateJournal();
    } else {
      res = await this._createJournal();
      this.getJournalWordsCount();
      NewJournalingStore.getUserMoods();
      AppStore.postNavigate('JournalReward', {
        isMoodTracker: this.type === 'mood_tracker',
        isAnytimeJournal: this.isAnytimeJournal,
        showScratchCard: showRewardScreen,
      });
    }

    return res;
  }

  saveVoiceInBackground = async id => {
    const options = {
      taskName: 'MyBackgroundTask',
      taskTitle: 'My Background Task',
      taskDesc: 'Performing background voice save',
      taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
      },
      color: '#ff00ff',
      linkingURI: 'yourScheme://chat',
      parameters: {
        delay: 1000,
      },
    };

    // Call saveImageHandler for each image
    BackgroundActions.start(() => this.saveVoiceHandler(), options);

    DeviceEventEmitter.addListener('backgroundActions.taskCompleted', e => {
      const data = e.detail;
      if (data.taskName === 'MyBackgroundTask') {
        // Handle task completion here
        BackgroundActions.stop();
      }
    });

    DeviceEventEmitter.addListener('backgroundActions.taskError', e => {
      const data = e.detail;
      if (data.taskName === 'MyBackgroundTask') {
        // Handle task error here
        captureException(e);
        console.error('MyBackground Task Error');
        BackgroundActions.stop();
      }
    });
  };

  saveVoiceHandler = async () => {
    const formData = new FormData();
    let qsConvertedString = '';

    if (this.tempVoiceNote) {
      const parts = this.tempVoiceNote.split('/');
      const filename = parts[parts.length - 1];
      formData.append('voice_note', {
        uri: this.tempVoiceNote,
        type: 'audio/mp3',
        name: filename,
      });
      formData.append('voice_note_duration', this.tempVoiceNoteDuration);
    } else {
      let params = {voice_note: '', voice_note_duration: 0};

      Object.entries(params).forEach(([key, value]) => {
        qsConvertedString = `${qsConvertedString}${key}=${value}&`;
      });
    }

    await fetch(`${Config.JOURNAL_BASE_URL}usernotes/${this.userNoteId}/`, {
      method: 'PUT',
      crossorigin: true,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      headers: {
        'Content-type': this.tempVoiceNote
          ? 'multipart/form-data'
          : 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Bearer ${TokenStore.accessToken}`,
      },
      body: this.tempVoiceNote ? formData : qsConvertedString,
    })
      .then(async response => {
        let newFormat = await response.json();
        EventBus.journalEntryUpdated(newFormat);
        // switch (parseInt(newFormat?.note)) {
        //   case 29:
        //     TodayStore.setFields('lastVoiceNote', {
        //       ...TodayStore.lastVoiceNote,
        //       noteId: newFormat?.note,
        //       userNoteId: newFormat?.id,
        //       moodVoiceNote: newFormat?.voice_note,
        //       moodVoiceNoteDuration: parseInt(newFormat?.voice_note_duration),
        //     });
        //     break;

        //   case 31:
        //     TodayStore.setFields('lastVoiceNote', {
        //       ...TodayStore.lastVoiceNote,
        //       noteId: newFormat?.note,
        //       userNoteId: newFormat?.id,
        //       shuffleVoiceNote: newFormat?.voice_note,
        //       shuffleVoiceNoteDuration: parseInt(
        //         newFormat?.voice_note_duration,
        //       ),
        //     });
        //     break;

        //   case 46:
        //     TodayStore.setFields('lastVoiceNote', {
        //       ...TodayStore.lastVoiceNote,
        //       noteId: newFormat?.note,
        //       userNoteId: newFormat?.id,
        //       journalVoiceNote: newFormat?.voice_note,
        //       journalVoiceNoteDuration: parseInt(
        //         newFormat?.voice_note_duration,
        //       ),
        //     });
        //     break;
        // }
      })
      .catch(e => {
        this.loading = false;
        captureException(e);
        Toast(`Sorry, Voice couldn't be saved`);
        console.error('User Save Voice Response Error', e);
      });
  };

  saveImageInBackground = async id => {
    let englishJournal = Object.values(this.journalEntry)[0];
    let firstPrompt = {...englishJournal[0]}; // 0 means first value

    const options = {
      taskName: 'MyBackgroundTask',
      taskTitle: 'My Background Task',
      taskDesc: 'Performing background image save',
      taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
      },
      color: '#ff00ff',
      linkingURI: 'yourScheme://chat',
      parameters: {
        delay: 1000,
      },
    };

    firstPrompt.text.forEach(item => {
      // Check if the item is an object and has a property named 'image'
      if (typeof item === 'object' && item.image) {
        // Call saveImageHandler for each image
        BackgroundActions.start(
          () => this.saveImageHandler(item.image),
          options,
        );
      }
    });

    DeviceEventEmitter.addListener('backgroundActions.taskCompleted', e => {
      const data = e.detail;
      if (data.taskName === 'MyBackgroundTask') {
        // Handle task completion here
        BackgroundActions.stop();
      }
    });

    DeviceEventEmitter.addListener('backgroundActions.taskError', e => {
      const data = e.detail;
      if (data.taskName === 'MyBackgroundTask') {
        // Handle task error here
        captureException(e);
        console.error('MyBackground Task Error');
        BackgroundActions.stop();
      }
    });
  };

  saveImageHandler = async item => {
    const formData = new FormData();

    formData.append('usernote', this.noteId);
    formData.append('image', {
      uri: item.image,
      type: item.type,
      name: item.name,
    });
    formData.append('identifier', item.id);

    await fetch(`${Config.JOURNAL_BASE_URL}usernote_image/`, {
      method: 'POST',
      crossorigin: true,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      headers: {
        'Content-type': 'multipart/form-data',
        Accept: 'application/json',
        Authorization: `Bearer ${TokenStore.accessToken}`,
      },
      body: formData,
    })
      .then(async response => {
        let newFormat = await response.json();
      })
      .catch(e => {
        this.loading = false;
        captureException(e);
        Toast(`Sorry, Image couldn't be saved`);
        console.error('User Save Image Response Error', e);
      });
  };

  async _updateJournal() {
    this.loading = true;

    let params = {
      content: this.journalEntry,
    };

    let newParams = JSON.stringify(params);

    let eventParams = {
      developer_id: AppStore.developerId,
      title: this.title,
      id: this.noteId,
    };
    appAnalytics('journal_edit', eventParams, false);
    trackMixpanelEvent('journal_edit', eventParams);

    try {
      const response = await fetch(
        `${Config.JOURNAL_BASE_URL}usernotes/${this.userNoteId}/`,
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
      );

      let newFormat = await response.json();

      EventBus.journalEntryUpdated(newFormat);
      EventBus.confettiEvent(this.title, 500);

      this.saveVoiceInBackground();

      this.loading = false;

      return {
        postGoBack: true,
        showToast: true,
        reload: true,
        savedJournalEntry: newFormat,
        reloadHistory: true,
        showErrorToast: false,
      };
    } catch (e) {
      this.loading = false;
      captureException(e);
      console.error('updateUserJournal error => ', e);

      try {
        if (e.response) {
          const {status, data} = e.response;
          switch (status) {
            case 401:
              TokenStore.getRefreshToken({
                className: this,
                functionName: '_updateJournal',
              });
              break;

            default:
              break;
          }
        }
      } catch (error) {
        captureException(error);
        console.error('_updateJournal => ', error);
        return {postGoBack: false, showErrorToast: true};
      }
    }
  }

  async _createJournal() {
    this.loading = true;

    let journalEntryCopy = JSON.parse(JSON.stringify(this.journalEntry));
    let englishJournal = Object.values(journalEntryCopy)[0];
    let firstPrompt = {...englishJournal[0]}; // 0 means first prompt

    firstPrompt?.text?.forEach(item => {
      // Check if the item is an object and has a property named 'image'
      if (typeof item === 'object' && item.image) {
        item.image = {
          id: item.image.id.toString(),
          localPath: item.image.image,
        };
      }
    });

    let eventParams = {
      developer_id: AppStore.developerId,
      title: 'Save Journal',
      id: this.noteId,
    };
    appAnalytics('journal_done', eventParams, false);
    trackMixpanelEvent('journal_done', eventParams);

    let params = {
      note: this.noteId,
      content: journalEntryCopy,
      is_done: true,
    };

    let newParams = JSON.stringify(params);

    try {
      let response = await fetch(`${Config.JOURNAL_BASE_URL}usernotes/`, {
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
      });

      let newFormat = await response.json();
      this.loading = false;
      this.userNoteId = newFormat?.id;
      this.createdAt = newFormat?.created_at;
      this.isDone = true;

      EventBus.journalEntrySaved(newFormat);
      EventBus.confettiEvent(this.title, 500);

      // Saving Image in background
      this.saveImageInBackground(newFormat.id);

      //Saving Voice in background
      this.saveVoiceInBackground();

      return {
        postGoBack: false,
        showToast: false,
        reload: true,
        savedJournalEntry: newFormat,
        reloadHistory: true,
        showErrorToast: false,
      };
    } catch (e) {
      this.loading = false;
      captureException(e);
      console.error('Create Journal Error', e);

      try {
        if (e.response) {
          const {status, data} = e.response;
          switch (status) {
            case 401:
              TokenStore.getRefreshToken({
                className: this,
                functionName: '_createJournal',
              });
              break;

            default:
              break;
          }
        }
      } catch (error) {
        captureException(error);
        console.error('_createJournal => ', error);
        return {postGoBack: false, showErrorToast: true};
      }
    }
  }

  async getJournalWordsCount() {
    try {
      let response = await fetch(`${Config.JOURNAL_BASE_URL}journal_count/`, {
        method: 'GET',
        crossorigin: true,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        headers: {
          'Content-type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${TokenStore.accessToken}`,
          'Profile-ID': AppStore?.userProfileInfo?.id,
        },
      });
      response = await response.json();
      this.wordsCountData = response;
    } catch (error) {
      console.error('getJournalWordsCount', JSON.stringify(error));
      captureException(error);
    }
  }
}

export default Journal;
