import {action, computed, observable, toJS, makeObservable} from 'mobx';
import {getData, patchData} from '../utils/api';
import {
  Toast,
  appAnalytics,
  convertUtcToLocal,
  currentTimeStamp,
  daysFromToday,
  trackMixpanelEvent,
} from '../utils/helper';
import AppStore from './AppStore';
import HomeStore from './HomeStore';
import TokenStore from './TokenStore';
import JournalStore from './JournalStore';
import Config from 'react-native-config';
import {captureEvent, captureException} from '@sentry/react-native';
import TodayStore from './TodayStore';
import {
  View,
  Text,
  Image,
  TextInput,
  DeviceEventEmitter,
  TouchableHighlightBase,
} from 'react-native';
import EStyleSheet from 'react-native-extended-stylesheet';
import Colors from '../utils/Colors';
import ImagePicker from 'react-native-image-crop-picker';
import Theme from '../utils/Theme';
import {v4 as uuidv4} from 'uuid';
import BackgroundActions from 'react-native-background-actions';
import IconPack from '../utils/IconPack';
import EventBus from '../EventBus';
import moment from 'moment';
import MoodTracker from '../models/Journal/MoodTracker';
import Journal from '../models/Journal/Journal';
import Shuffle from '../models/Journal/Shuffle';
import Mood from '../models/Journal/Mood';
import {createJournalModel} from '../models/Journal/JournalFactory';

const hRem = AppStore?.wHeight / 2688;
const wRem = AppStore?.wWidth / 1242;

class NewJournalingStore {
  newJournalingListApiState = 'loading';

  currentScreen = false;

  template = [];

  textWithImageTemplate = [];

  templateID = '';

  /** Moods available to the user as option to register their mood */
  moods = [];

  /** Mood tracking history of the user. */
  moodsHistory = [];

  updatedTextWithImages = '';

  journalingHistoryList = [];

  getHistoryData = {};

  getEmojiPrompt = '';

  getEmojiText = '';

  currentCursorPosition = 0;

  isJournaled = true;

  firstJournalingDate = null;

  currentTextImageInput = 0;

  promptText = '';

  defaultPrompt = '';

  editEntryText = '';

  newJournalHistoryData = {results: []};

  searchJournalHistoryData = {results: []};

  dailyJournalingList = [];

  loading = false;

  journalingHistoryListApiState = 'pending';

  pullToRefresh = false;

  currentTemplateIndex = 0;

  nextPageUrl = null;

  imageCounter = 0;

  monthWiseJournalingList = [];

  cursorPosition = 0;

  isKeyboardVisible = false;

  scrollViewContentSize = 0;

  journalTextLength = 0;

  journal = null;

  userMoods = [];

  isNextMoodAvailable = true;

  firstMoodEntryDate = null;

  moodChartData = [];

  minDays = 7;

  constructor() {
    makeObservable(this, {
      newJournalingListApiState: observable,
      template: observable,
      loading: observable,
      currentScreen: observable,
      getHistoryData: observable,
      promptText: observable,
      updatedTextWithImages: observable,
      currentTextImageInput: observable,
      defaultPrompt: observable,
      moods: observable,
      getEmojiPrompt: observable,
      moodsHistory: observable,
      getEmojiText: observable,
      isJournaled: observable,
      firstJournalingDate: observable,
      templateID: observable,
      nextPageUrl: observable,
      cursorPosition: observable,
      currentTemplateIndex: observable,
      journalingHistoryListApiState: observable,
      pullToRefresh: observable,
      monthWiseJournalingList: observable,
      textWithImageTemplate: observable,
      editEntryText: observable,
      dailyJournalingList: observable,
      imageCounter: observable,
      journalingHistoryList: observable,
      newJournalHistoryData: observable,
      searchJournalHistoryData: observable,
      isKeyboardVisible: observable,
      scrollViewContentSize: observable,
      journalTextLength: observable,
      journal: observable,
      userMoods: observable,
      isNextMoodAvailable: observable,
      firstMoodEntryDate: observable,
      minDays: observable,
      moodChartData: observable,
      setFields: action,
      gratitudeJournalHandler: action,
      getMoodsHistory: action,
      getNewJournalingHistoryListApi: action,
      groupingToDateJournalingHistoryHandler: action,
      mergeJournalHistoryHandler: action,
      handleSelectionChange: action,
      setKeyboardVisible: action,
      handleContentSizeChangeScrollView: action,
      fetchShufflePrompt: action,
      getUserMoods: action,
      updateHistoryAfterSave: action,
      updateMoodHistoryAfterSave: action,
      initMoodChartData: action,
      getDaysBetween: action,
      getSevenDatesFrom: action,
      prepareMoodChartData: action,
      handleEndReachedMood: action,
      updateVoiceNoteHistoryAfterSave: action,
      isMoodTrackingDone: computed,
    });
    this.minDays = 7;
  }

  setFields(eName, data) {
    this[eName] = data;
  }

  handleSelectionChange = ({nativeEvent: {selection}}) => {
    this.cursorPosition = selection.start;
  };

  setKeyboardVisible = val => {
    this.isKeyboardVisible = val;
  };

  handleContentSizeChangeScrollView = (width, height) => {
    this.scrollViewContentSize = height;
  };

  // Create a function to convert and format the array
  groupingToDateJournalingHistoryHandler = originalArray => {
    const formattedArray = [];

    originalArray.forEach(monthObj => {
      for (const month in monthObj) {
        const formattedMonth = {};
        formattedMonth[month] = [];

        const dateMap = {};

        monthObj[month].forEach(item => {
          const createdDate = new Date(item.created_at);
          const formattedDate = createdDate.toLocaleDateString('en-US', {
            // year: 'numeric',
            day: 'numeric',
            month: 'long',
          });

          if (!dateMap[formattedDate]) {
            dateMap[formattedDate] = [];
          }

          dateMap[formattedDate].push(item);
        });

        for (const date in dateMap) {
          const dateObj = {};
          dateObj[date] = dateMap[date];
          formattedMonth[month].push(dateObj);
        }

        formattedArray.push(formattedMonth);
      }
    });

    this.setFields('newJournalHistoryList', formattedArray);
  };

  mergeJournalHistoryHandler = () => {
    let oldJournalHistory = JournalStore.dailyJournalHistoryList;

    // Create an object to store the merged data
    const mergedData = {};

    // Merge data from array1 into the mergedData object
    for (const monthData of this.journalingHistoryList) {
      for (const month in monthData) {
        if (mergedData[month] === undefined) {
          mergedData[month] = [];
        }
        mergedData[month] = mergedData[month].concat(monthData[month]);
      }
    }

    // Merge data from array2 into the mergedData object
    for (const entry of oldJournalHistory) {
      const created_at = new Date(entry.created_at);
      const month = created_at.toLocaleString('en-US', {month: 'long'});

      // If the ic content is null for that month then the specified month won't be shown
      if (entry.ic_content !== null) {
        if (mergedData[month] === undefined) {
          mergedData[month] = [];
        }
        mergedData[month].push(entry);
      }
    }

    // Convert the merged data object to the desired format
    const mergedArray = Object.entries(mergedData).map(([month, data]) => ({
      [month]: data,
    }));

    // Print the result

    let newJournalHistory = mergedArray;

    newJournalHistory.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );

    this.groupingToDateJournalingHistoryHandler(newJournalHistory);
  };

  gratitudeJournalHandler = async () => {
    // JournalStore.setFields('pullToRefresh', true);
    // const timeStamp = currentTimeStamp();
    // await fetch(`${Config.JOURNAL_BASE_URL}journal/${timeStamp}/`, {
    //   method: 'GET',
    //   crossorigin: true,
    //   'Access-Control-Allow-Origin': '*',
    //   'Access-Control-Allow-Credentials': true,
    //   headers: {
    //     'Content-type': 'application/json',
    //     Accept: 'application/json',
    //     Authorization: `Bearer ${TokenStore.accessToken}`,
    //   },
    // })
    //   .then(async response => {
    //     if (response.ok) {
    //       //range 200 - 299
    //       let newFormat = await response.json();
    //       let dailyJournalingList = await this.createJournalObjects(newFormat);
    //       this.setFields('dailyJournalingList', dailyJournalingList);
    //     } else {
    //       // other ranges, 400, 401, 403 etc...
    //       // Handle specific status codes if needed
    //       if (response.status === 401) {
    //         TokenStore.getRefreshToken({
    //           className: this,
    //           functionName: 'gratitudeJournalHandler',
    //         });
    //       } else {
    //         captureException(response.statusText);
    //       }
    //     }
    //     JournalStore.setFields('pullToRefresh', false);
    //   })
    //   .catch(e => {
    //     captureException(e);
    //     console.error('Journal Error', e);
    //     JournalStore.setFields('pullToRefresh', false);
    //   });
  };

  /**
   * After user saves journal entry, update the history locally without server calls.
   *
   * @param {*} savedJournalEntry
   */
  updateHistoryAfterSave = savedJournalEntry => {
    let matchingItem = null;
    this.newJournalHistoryData.forEach(aJournalEntry => {
      if (aJournalEntry.userNoteId === savedJournalEntry.id) {
        matchingItem = aJournalEntry;
      }
    });
    if (matchingItem) {
      // update
      matchingItem.journalEntry = this.journal.journalEntry;
    } else {
      // add to top
      //this.newJournalHistoryData.unshift(this.journal.deepCopy());

      this.newJournalHistoryData = [
        this.journal.deepCopy(),
        ...this.newJournalHistoryData,
      ];
    }
  };

  updateVoiceNoteHistoryAfterSave(audioPath, audioDuration) {
    let matchingItem = null;
    this.newJournalHistoryData.forEach(aJournalEntry => {
      if (
        aJournalEntry?.userNoteId === this.journal?.userNoteId &&
        aJournalEntry?.noteId === this.journal?.noteId
      ) {
        matchingItem = aJournalEntry;
      }
    });
    if (matchingItem) {
      // update
      matchingItem.tempVoiceNote = audioPath;
      matchingItem.voiceNote = audioPath;
      matchingItem.voiceNoteDuration = audioDuration;
      matchingItem.tempVoiceNoteDuration = audioDuration;
    }
  }

  updateMoodHistoryAfterSave = savedMoodEntry => {
    this.userMoods = this.addObjectOrUpdate(savedMoodEntry, this.userMoods);
    const isMoodAlreadyExist = this.moodChartData.some(
      item =>
        new Date(item.created_at).toLocaleDateString() ===
        new Date(savedMoodEntry.created_at).toLocaleDateString(),
    );
    if (isMoodAlreadyExist) {
      this.moodChartData = this.addObjectOrUpdate(
        savedMoodEntry,
        this.moodChartData,
      );
      return;
    }
    this.initMoodChartData();
  };

  addObjectOrUpdate(newObj, passedArray) {
    const dateToCheck = new Date(newObj.created_at).toLocaleDateString(); // Extract date without time

    let array = [...passedArray];
    const existingIndex = array.findIndex(
      item => new Date(item.created_at).toLocaleDateString() === dateToCheck,
    );

    if (existingIndex !== -1) {
      // If an object with the same date is found, replace it
      array.splice(existingIndex, 1, newObj);
    } else {
      // If not found, add the new object
      array.push(newObj);
    }

    return array;
  }

  handleEndReachedMood() {
    this.minDays = this.minDays + 7;
    this.initMoodChartData();
  }

  initMoodChartData() {
    let sevenDays = [];
    let preparedMoodChartList = [];

    if (!this.userMoods || this.userMoods?.length <= 0) {
      sevenDays = this.getSevenDatesFrom(new Date().toISOString());
      sevenDays = sevenDays.reverse();
      this.moodChartData = this.prepareMoodChartData(sevenDays);
    } else if (
      this.userMoods &&
      this.firstMoodEntryDate &&
      daysFromToday(this.firstMoodEntryDate) >= 6
    ) {
      // Calculate today - 7 days

      // const today = new Date();
      // const sevenDaysAgo = new Date();
      // sevenDaysAgo.setDate(today.getDate() - 6);
      // const lastSevenDays = getSevenDatesFrom(sevenDaysAgo);
      // sevenDays = lastSevenDays;

      let currentDate = new Date();
      // currentDate.setDate(currentDate.getDate() + 6);
      const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day

      let fetchStartDate = new Date(currentDate);
      fetchStartDate = new Date(fetchStartDate - this.minDays * oneDay);
      let oneWeekIntervalDate = new Date(
        currentDate - (this.minDays - 7) * oneDay,
      );

      sevenDays = this.getDaysBetween(fetchStartDate, oneWeekIntervalDate);

      preparedMoodChartList = this.prepareMoodChartData(sevenDays);
      this.moodChartData = this.mergeArrays(
        this.moodChartData,
        preparedMoodChartList,
      );
    } else {
      const dateToUse = this.firstMoodEntryDate
        ? new Date(this.firstMoodEntryDate)
        : new Date();
      const currentSevenDays = this.getSevenDatesFrom(dateToUse.toISOString());
      sevenDays = currentSevenDays?.reverse();
      this.moodChartData = this.prepareMoodChartData(sevenDays);
    }
  }

  mergeArrays(array1, array2) {
    const mergedMap = new Map();

    [...array1, ...array2].forEach(item => {
      const key = item.created_at;
      if (!mergedMap.has(key)) {
        mergedMap.set(key, {...item});
      } else {
        mergedMap.set(key, {...mergedMap.get(key), ...item});
      }
    });

    return Array.from(mergedMap.values());
  }

  getDaysBetween(startDateStr, oneWeekIntervalDate) {
    let userDatesTillMoodTracked = [];
    const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day
    let firstJournalingDate = this.firstMoodEntryDate;
    firstJournalingDate = new Date(firstJournalingDate);
    firstJournalingDate = firstJournalingDate.getTime();

    const startDate = new Date(startDateStr);
    const startDateTime = startDate.getTime();
    const currentDateTime = oneWeekIntervalDate.getTime();

    if (firstJournalingDate > currentDateTime) {
      return userDatesTillMoodTracked;
    }

    for (let time = currentDateTime; time > startDateTime; time -= oneDay) {
      const date = new Date(time);
      userDatesTillMoodTracked.push(date.toISOString());
    }

    return userDatesTillMoodTracked;
  }

  getSevenDatesFrom(startingDate) {
    const datesArray = [];
    const currentDate = new Date(startingDate);

    for (let i = 0; i < 7; i++) {
      datesArray.push(new Date(currentDate)); // Push a new Date object to the array
      currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
    }

    return datesArray;
  }

  prepareMoodChartData(sevenDays) {
    //mood history
    const moodChartData = sevenDays.map((date, index) => {
      const matchedItem = this.userMoods.find(item =>
        moment(item.created_at)
          .format('DD-MM-YYYY')
          .includes(moment(date).format('DD-MM-YYYY')),
      );

      if (matchedItem) {
        const moodObj = new Mood(
          matchedItem?.usernote,
          matchedItem?.id,
          matchedItem?.emoji_name,
          matchedItem?.emoji,
          matchedItem?.created_at,
        );
        return moodObj;
      } else {
        const moodObj = new Mood('', '', '', '', date);
        return moodObj;
      }
    });

    return moodChartData;
  }

  /**
   * Used for creating Journal objects for history view, under Journal section
   * @param {the list of raw journal objects, from history list} item
   * @returns
   */
  createJournalObjects = async historyItems => {
    let journalObj = {};
    let journalHistoryList = [];
    let note_id = null;
    let userNoteId = null;

    for (let i = 0; i < historyItems?.length; i++) {
      const aJournalHistoryItem = historyItems[i];

      if (aJournalHistoryItem?.is_completed || aJournalHistoryItem?.note) {
        note_id = parseInt(aJournalHistoryItem?.note);
        userNoteId = aJournalHistoryItem?.id;
      } else {
        note_id = parseInt(aJournalHistoryItem?.id);
        userNoteId = null;
      }

      switch (note_id) {
        case 31: // hard coded for shuffle journaling
          journalObj = await createJournalModel(
            note_id,
            userNoteId,
            Journal.SHUFFLE,
            aJournalHistoryItem?.content,
            null,
            aJournalHistoryItem?.is_new_journaling ||
              aJournalHistoryItem?.is_newjournaling
              ? true
              : false,
            aJournalHistoryItem?.created_at,
            aJournalHistoryItem?.title,
            aJournalHistoryItem?.is_done,
            aJournalHistoryItem?.classification,
            aJournalHistoryItem?.voice_note,
            aJournalHistoryItem?.voice_note_duration,
          );
          break;
        case 29: // hard coded for mood tracker
          journalObj = await createJournalModel(
            note_id,
            userNoteId,
            Journal.MOOD_TRACKER,
            aJournalHistoryItem?.content,
            null,
            aJournalHistoryItem?.is_new_journaling ||
              aJournalHistoryItem?.is_newjournaling
              ? true
              : false,
            aJournalHistoryItem.created_at,
            aJournalHistoryItem?.title,
            aJournalHistoryItem?.is_done,
            aJournalHistoryItem?.classification,
            aJournalHistoryItem?.voice_note,
            aJournalHistoryItem?.voice_note_duration,
          );
          break;
        default:
          journalObj = await createJournalModel(
            note_id,
            userNoteId,
            Journal.JOURNAL,
            aJournalHistoryItem?.content,
            null,
            aJournalHistoryItem?.is_new_journaling ||
              aJournalHistoryItem?.is_newjournaling
              ? true
              : false,
            aJournalHistoryItem.created_at,
            aJournalHistoryItem?.title,
            aJournalHistoryItem?.is_done,
            aJournalHistoryItem?.classification,
            aJournalHistoryItem?.voice_note,
            aJournalHistoryItem?.voice_note_duration,
          );
      }
      journalHistoryList.push(journalObj);
    }
    return journalHistoryList;
  };

  async getNewJournalingHistoryListApi(
    content = '',
    isLoadMoreRequest = false,
    isSearchRequest = false,
  ) {
    this.setFields('journalingHistoryListApiState', 'loading');

    let urlToGetData = `${Config.JOURNAL_BASE_URL}user_history/?content=${content}`;

    if (isLoadMoreRequest) {
      if (isSearchRequest && this.searchJournalHistoryData.next) {
        urlToGetData = this.searchJournalHistoryData.next;
      } else if (!isSearchRequest && this.newJournalHistoryData.next) {
        urlToGetData = this.newJournalHistoryData.next;
      } else {
        // if next url is null then don't send request again.
        this.setFields('journalingHistoryListApiState', 'done');
        return;
      }
    }

    await fetch(urlToGetData, {
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
        let newData = await response.json();

        let historyList = [];
        if (newData?.results) {
          historyList = await this.createJournalObjects(newData?.results);
        }

        //empty data for new request
        if (!isSearchRequest && !isLoadMoreRequest) {
          this.newJournalHistoryData = {results: []};
        }
        if (isSearchRequest && !isLoadMoreRequest) {
          this.searchJournalHistoryData = {results: []};
        }

        // Pagination Code
        let existingData = toJS(
          isSearchRequest
            ? this.searchJournalHistoryData
            : this.newJournalHistoryData,
        );
        existingData.results.push(...historyList);
        // newData.results = existingData.results;

        // need to be commented
        this.setFields(
          isSearchRequest
            ? 'searchJournalHistoryData'
            : 'newJournalHistoryData',
          existingData.results,
        );
        this.setFields('journalingHistoryListApiState', 'done');
        this.setFields('pullToRefresh', false);
        this.setFields('loading', false);
      })
      .catch(e => {
        captureException(e);
        console.error('Get User History New Templates Error', e.message);
        this.setFields('loading', false);
        this.setFields('journalingHistoryListApiState', 'error');

        try {
          if (e.response) {
            const {status, data} = e.response;
            switch (status) {
              case 401:
                TokenStore.getRefreshToken({
                  className: this,
                  functionName: 'getNewJournalingHistoryListApi',
                });
                break;

              default:
                break;
            }
          }
        } catch (error) {
          captureException(error);
          console.error('tryCatchError getNewJournalingHistoryListApi', error);
        }
      });
  }

  resetJournalSection = () => {
    this.journalList = [];
    this.dailyJournalHistoryList = [];
  };

  /**
   * Fetches all the available moods from the server.
   */
  getEmojisHandler = async () => {
    await fetch(`${Config.JOURNAL_BASE_URL}emojis/`, {
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
        let newFormat = await response.json();
        this.setFields('moods', newFormat);
      })
      .catch(e => {
        captureException(e);
        console.error('Get Emojis Response Error', e);
      });
  };

  async navigateToMoodEditor(userEmojiId) {
    if (!userEmojiId) {
      return;
    }

    AppStore.setFields('isLoading', true);

    getData(`${Config.JOURNAL_BASE_URL}mood/${userEmojiId}`)
      .then(async res => {
        const {usernote} = res?.data || {};
        this.journal = await createJournalModel(
          usernote?.note,
          usernote?.id,
          Journal.MOOD_TRACKER,
          usernote?.content,
          null,
          true,
          usernote?.created_at,
          '',
          usernote?.is_done,
          usernote?.classification,
          usernote?.voice_note,
          usernote?.voice_note_duration,
        );

        AppStore.postNavigate('JournalingEditor', {
          id: usernote?.id,
          title: 'track your mood',
        });
        AppStore.setFields('isLoading', false);
      })
      .catch(err => {
        console.error('navigateToMoodEditor', err);
        captureException(err);
        AppStore.setFields('isLoading', false);
      });
  }

  async getUserMoods(page = 1) {
    await fetch(`${Config.JOURNAL_BASE_URL}moods/?page=${page}`, {
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
      .then(async res => {
        const newFormat = await res.json();
        this.userMoods = newFormat?.results;
        this.firstMoodEntryDate = newFormat?.first_entry?.created_at;
        this.isNextMoodAvailable = newFormat?.next ? true : false;
        this.initMoodChartData();
      })
      .catch(err => {
        console.error('getUserMoods', err);
        try {
          if (err.response) {
            const {status, data} = err.response;
            switch (status) {
              case 401:
                TokenStore.getRefreshToken({
                  className: this,
                  functionName: 'getUserMoods',
                });
                break;

              default:
                break;
            }
          }
        } catch (error) {
          captureException(error);
          console.error('tryCatchError getUserMoods', error);
        }
      });
  }

  getMoodsHistory = async () => {
    await fetch(`${Config.JOURNAL_BASE_URL}mood_tracker/`, {
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
        let newFormat = await response.json();
        if (newFormat.length !== 0) {
          this.setFields('isJournaled', true);
          this.setFields(
            'firstJournalingDate',
            newFormat[newFormat.length - 1].created_at,
          );
          this.setFields('moodsHistory', newFormat);
        }
      })
      .catch(e => {
        captureException(e);
        console.error('Get Mood Chart Response Error', e);

        try {
          if (e.response) {
            const {status, data} = e.response;
            switch (status) {
              case 401:
                TokenStore.getRefreshToken({
                  className: this,
                  functionName: 'getUserMoods',
                });
                break;

              default:
                break;
            }
          }
        } catch (error) {
          captureException(error);
          console.error('tryCatchError getMoodsHistory', error);
        }
      });
  };

  // Shuffle Prompt
  async fetchShufflePrompt(selectedCategoryId) {
    const categoryParams = selectedCategoryId
      ? `&tags=${selectedCategoryId}`
      : '';

    try {
      const response = await fetch(
        `${Config.JOURNAL_BASE_URL}random_prompt/?random=true${categoryParams}`,
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
      );

      const newFormat = await response.json();
      // .then(async response => {
      return newFormat;
    } catch (exception) {
      captureException(exception);
      console.error('Shuffle Prompts Response Error', exception);

      try {
        if (exception.response) {
          const {status, data} = exception.response;
          switch (status) {
            case 401:
              TokenStore.getRefreshToken({
                className: this,
                functionName: 'fetchShufflePrompt',
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
    }
  }

  onRefresh = () => {
    this.gratitudeJournalHandler();

    this.getUserMoods();

    this.getNewJournalingHistoryListApi();

    JournalStore.dailyJournalHistoryListApi();
  };

  get isMoodTrackingDone() {
    let isMoodTrackingDone = false;

    this.newJournalHistoryData?.forEach?.(item => {
      const currentDay = moment().day();
      const createdAtDay = moment(item?.createdAt).day();

      if (item.type === 'mood_tracker' && currentDay === createdAtDay) {
        isMoodTrackingDone = true;
      }
    });

    return isMoodTrackingDone;
  }
}

export default new NewJournalingStore();

export const styles = EStyleSheet.create({
  inputContainer: {
    ...Theme.ffLatoRegular14,
    color: Colors.textBlackColor,
    fontSize: hRem * 54,
    paddingBottom: hRem * 63,
    textAlignVertical: 'top',
  },
  darkInputContainer: {
    ...Theme.ffLatoRegular14,
    color: Colors.white,
    fontSize: hRem * 54,
    paddingBottom: hRem * 63,
    textAlignVertical: 'top',
  },
  imageContainer: {
    width: wRem * 1116,
    height: undefined,
    aspectRatio: 1,
    alignSelf: 'center',
    borderRadius: hRem * 39,
    marginBottom: hRem * 63,
  },
});
