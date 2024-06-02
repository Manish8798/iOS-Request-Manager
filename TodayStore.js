import {Share} from 'react-native';
import branch from 'react-native-branch';
import {action, computed, observable, toJS, makeObservable} from 'mobx';
import moment from 'moment';
import config, {Config} from 'react-native-config';
import * as StoreReview from 'react-native-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {getData, postData} from '../utils/api';
import {
  Toast,
  appAnalytics,
  appRateUs,
  currentTimeStamp,
  getTimeStamp,
  showRateUsAlert,
  trackMixpanelEvent,
} from '../utils/helper';
import AppStore from './AppStore';
import HomeStore from './HomeStore';
import TokenStore from './TokenStore';
import {captureException} from '@sentry/react-native';
import SleepStore from './SleepStore';
import NewJournalingStore from './NewJournalingStore';
import JournalStore from './JournalStore';
import EventBus from '../EventBus';
import TodayCard from '../models/TodayHome/TodayCard';
import Shuffle from '../models/Journal/Shuffle';
import AffirmationsStore from './AffirmationsStore';

class TodayStore {
  todayListApiState = 'pending';

  todayList = [];

  todayListObj = null;

  pullToRefresh = false;

  todayHistoryApiDoneState = 'pending';

  todayHistoryList = [];

  quickComplete = false;

  customizeModal = false;

  //============ below integration for new today home screens ===================

  updatedUserPrefJson = null;

  newTodayHomeList = [];
  newTodayHomeApiState = 'pending';

  newHomeContentObj = null;

  userPrefListApiState = 'pending';

  userPrefListData = [];

  pullToRefreshNewHome = false;

  savingUserPrefernces = false;

  selectedDateTimeStamp = getTimeStamp(0);

  tomorrowHomeList = [];

  dayAfterTomorrowHomeList = [];

  fourthDayHomeList = [];

  fifthDayHomeList = [];

  sixthDayHomeList = [];

  showConfettiStatus = false;

  userLocalPrefListData = [];

  todayCards = [];

  tomorrowCards = [];

  dayAfterTomorrowCards = [];

  fourthDay = [];

  fifthDay = [];

  sixthDay = [];

  activeRoutineCardData = null;

  showHomeScreenDateWidget = true;

  lastVoiceNote = {
    userNoteId: null,
    moodVoiceNote: null,
    moodVoiceNoteDuration: 0,
    shuffleVoiceNote: null,
    shuffleVoiceNoteDuration: 0,
    journalVoiceNote: null,
    journalVoiceNoteDuration: 0,
    noteId: null,
  };

  todayIllustrationIndex = null;

  todayRandomQuote =
    'Give yourself the same care and attention you give others & watch yourself bloom';

  todayHomeScrollOffset = 0;

  constructor() {
    makeObservable(this, {
      todayListApiState: observable,
      todayList: observable,
      todayListObj: observable,
      pullToRefresh: observable,
      todayHistoryApiDoneState: observable,
      todayHistoryList: observable,
      quickComplete: observable,
      customizeModal: observable,
      updatedUserPrefJson: observable,
      newTodayHomeApiState: observable,
      newTodayHomeList: observable,
      newHomeContentObj: observable,
      userPrefListApiState: observable,
      userPrefListData: observable,
      pullToRefreshNewHome: observable,
      savingUserPrefernces: observable,
      selectedDateTimeStamp: observable,
      tomorrowHomeList: observable,
      dayAfterTomorrowHomeList: observable,
      fourthDayHomeList: observable,
      fifthDayHomeList: observable,
      sixthDayHomeList: observable,
      showConfettiStatus: observable,
      userLocalPrefListData: observable,
      todayCards: observable,
      tomorrowCards: observable,
      dayAfterTomorrowCards: observable,
      fourthDay: observable,
      fifthDay: observable,
      sixthDay: observable,
      activeRoutineCardData: observable,
      showHomeScreenDateWidget: observable,
      lastVoiceNote: observable,
      todayIllustrationIndex: observable,
      todayRandomQuote: observable,
      todayHomeScrollOffset: observable,
      setFields: action,
      resetFields: action,
      todayListAPi: action,
      hideConfetti: action,
      todayHistoryDoneApi: action,
      todayPagePullToRefresh: computed,
      isShowStoryButton: computed,
      isNewStory: computed,
      storyButtonImage: computed,
      storyButtonText: computed,
      findTodayEmotion: computed,
      getCurrentDay: computed,
      getCurrentMonths: computed,
      getCurrentDate: computed,
      handleSwitchUserPref: action,
      newTodayHomeApi: action,
      newTodayHomeContentApi: action,
      convertPrefsToAppFormat: action,
      convertPrefsToServerFormat: action,
      fetchUserPrefListApi: action,
      saveUserPreferences: action,
      backgroundApiCalls: action,
      disableSaveButton: computed,
      onDateSelection: action,
      onDisabledCardPress: action,
      onTaskComplete: action,
      handleHomeScreenDateWidget: action,
      fetchDailyRandomQuote: action,
      setTodayIllustrationIndex: action,
      updateTodayHomeScrollOffset: action,
    });
  }

  setFields(eName, data) {
    this[eName] = data;
  }

  resetFields() {
    this.todayHistoryList = [];
    this.quickComplete = false;
  }

  shareEvent = async (shareContent, body, type) => {
    let cbuo = {};

    cbuo = {
      title: 'Evolve',
      contentDescription: shareContent.title,
      contentImageUrl: shareContent.image,
      contentMetadata: {
        customMetadata: {
          id: `${shareContent.id}`,
          type: type,
        },
      },
    };

    // only canonicalIdentifier is required
    let branchUniversalObject = await branch.createBranchUniversalObject(
      `share${shareContent.id}`,
      {
        locallyIndex: true,
        ...cbuo,
      },
    );

    let messageBody = `${body} \n`;

    let shareOptions = {
      messageHeader: '',
      messageBody,
    };

    // branchUniversalObject.showShareSheet(shareOptions, {}, {});
    let {url} = await branchUniversalObject.generateShortUrl();

    try {
      if (AppStore.isAndroid) {
        messageBody = messageBody.concat(url);
      } else {
        messageBody = messageBody;
      }

      const shareContent = {
        message: messageBody,
        title: 'Evolve',
        url: url,
      };

      const result = await Share.share(shareContent);

      if (result.action === Share.sharedAction) {
        // console.log('share was successful');
      } else if (result.action === Share.dismissedAction) {
        // console.log('dismissed share');
      }
    } catch (error) {
      console.error('RN share error', error);
    }
  };

  todayListAPi = async isDark => {
    this.todayListApiState = 'pending';

    this.todayList = [];

    const url = config.V4_BASE_URL;
    const todayEmotionId = 1;

    getData(
      isDark
        ? `${url}emotions/${todayEmotionId}/?dark_mode_image=true`
        : `${url}emotions/${todayEmotionId}`,
    )
      .then(res => {
        if (this.pullToRefresh) {
          this.todayList = [];
        }

        this.setFields('todayListObj', res.data);
        this.setFields('todayList', res.data);
        this.setFields('pullToRefresh', false);
        this.todayListApiState = 'done';
      })
      .catch(err => {
        captureException(err);
        console.error('ERROR' + err);
        this.todayListApiState = 'error';

        if (!err.response) {
          AppStore.setFailedApiList({
            className: 'TodayStore',
            functionName: 'todayListApi',
            isNetworkFailure: AppStore.isNetworkConnected,
          });
        }

        try {
          if (err.response) {
            const {status, data} = err.response;
            switch (status) {
              case 401:
                TokenStore.getRefreshToken({
                  className: this,
                  functionName: 'todayListApi',
                });
                break;

              default:
                break;
            }
          }
        } catch (error) {
          captureException(error);
          console.error('tryCatchError todayListApi', error);
        }
      });
  };

  backgroundApiCalls = toggleSleep => {
    // For Meditate Section Content Api
    HomeStore.clusterApi();

    // For Therapy Section Content Api
    if (HomeStore.journeysList.length === 0) {
      HomeStore.journeysListingApi();
    }
    if (HomeStore.featuredJourneysList.length === 0) {
      HomeStore.featuredJourneysApi();
    }
    if (HomeStore.continueJourneysList.length === 0) {
      HomeStore.continueJourneysApi();
    }

    if (AppStore.firstTimeFlow === '') {
      AppStore.setFirstTimeFlow('DONE');
    }

    // For Sleep Section Content Api
    SleepStore.sleepListApi(toggleSleep);

    // For Journal Section Content Api

    JournalStore.dailyJournalHistoryListApi();

    NewJournalingStore.gratitudeJournalHandler();

    NewJournalingStore.getNewJournalingHistoryListApi('', false);

    NewJournalingStore.mergeJournalHistoryHandler();

    NewJournalingStore.getUserMoods();
  };

  todayHistoryDoneApi = async () => {
    this.todayHistoryApiDoneState = 'pending';

    this.todayHistoryList = [];

    const timeStamp = currentTimeStamp();
    const url = config.V4_BASE_URL;

    getData(
      `${url}emotions/${this.findTodayEmotion?.id}/history/${timeStamp}/`,
      {},
    )
      .then(res => {
        const {status, data} = res?.data;

        if (status) {
          this.setFields('todayHistoryList', data?.content);

          this.todayHistoryApiDoneState = 'done';
        }
      })
      .catch(err => {
        captureException(err);
        console.error('todayHistoryDoneApi err', err);

        if (!err.response) {
          AppStore.setFailedApiList({
            className: 'TodayStore',
            functionName: 'todayHistoryDoneApi',
            isNetworkFailure: AppStore.isNetworkConnected,
          });
        }

        try {
          if (err.response) {
            const {status, data} = err.response;
            switch (status) {
              case 401:
                TokenStore.getRefreshToken({
                  className: this,
                  functionName: 'todayHistoryDoneApi',
                });
                break;

              default:
                break;
            }
          }
        } catch (error) {
          captureException(error);
          console.error('tryCatchError todayHistoryDoneApi', error);
        }
      });
  };

  hideConfetti = () => {
    setTimeout(() => {
      this.setFields('showConfettiStatus', false);
    }, 2500);
    // this.todayList = [];
    // this.todayHistoryList = [];
    // this.todayListAPi();
    // this.todayHistoryDoneApi();
    // this.newTodayHomeApi();
  };

  get todayPagePullToRefresh() {
    if (this.pullToRefresh) {
      return true;
    }
    return false;
  }
  // for button
  get isShowStoryButton() {
    if (this.findTodayEmotion != null) {
      return this.findTodayEmotion?.isShowStory;
    }
    return false;
  }

  get isNewStory() {
    if (!AppStore.isUserLoggedIn) {
      return true;
    }
    if (this.findTodayEmotion != null) {
      return this.findTodayEmotion?.isNewStory;
    }
    return false;
  }

  get storyButtonImage() {
    if (this.findTodayEmotion != null) {
      return this.isNewStory
        ? this.findTodayEmotion?.unseen_button_image
        : this.findTodayEmotion?.seen_button_image;
    }
    return '';
  }

  get storyButtonText() {
    if (this.findTodayEmotion != null) {
      const {seen_text, unseen_text} = this.findTodayEmotion;
      return this.isNewStory ? unseen_text : seen_text;
    }
    return '';
  }

  get findTodayEmotion() {
    const data = toJS(HomeStore.emotionsList);

    if (data.length > 0) {
      const todayEmotionObj = data.find(
        (item, index) => item.id == config.TODAY_ID,
      );
      if (todayEmotionObj) {
        return todayEmotionObj;
      }
    }
    return null;
  }

  get getCurrentDay() {
    const daysOfWeek = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ][new Date().getDay()];

    return daysOfWeek.substring(0, 3);
  }

  get getCurrentMonths() {
    const month = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ][new Date().getMonth()];

    return month.substring(0, 3);
  }

  get getCurrentDate() {
    let date = moment().date();

    return date;
  }

  //============ below integration for new today home screens ===================

  handleSwitchUserPref = id => {
    let updatedData = [...this.userLocalPrefListData];

    updatedData = updatedData.map((value, index) => {
      if (id === value.id && value.status !== undefined) {
        return {
          ...value,
          status: !value.status,
        };
      }

      return value;
    });

    return this.setFields('userLocalPrefListData', updatedData);
  };

  // load all cards for the home.
  newTodayHomeApi = async dayIndex => {
    if (dayIndex === 0) this.newTodayHomeApiState = 'pending';

    const url = config.V7_BASE_URL;
    this.fetchActiveCourseRoutine(dayIndex);

    getData(`${url}today_cluster/${getTimeStamp(dayIndex)}`, {})
      .then(async res => {
        const {data} = res.data;

        const initialPrompt = await NewJournalingStore.fetchShufflePrompt(
          Shuffle.DEFAULT_CATEGORY.id,
        );
        await AffirmationsStore.fetchDefaultBackgroundImage(false);

        data?.[0]?.today_cluster?.map((item, index) => {
          if (item?.today_cluster_card?.id === 31) {
            data[0].today_cluster[index].today_cluster_card.initialPrompt =
              initialPrompt;
          }
        });

        switch (dayIndex) {
          case 0:
            this.setFields('newTodayHomeList', data);
            break;
          case 1:
            this.setFields('tomorrowHomeList', data);
            break;
          case 2:
            this.setFields('dayAfterTomorrowHomeList', data);
            break;
          case 3:
            this.setFields('fourthDayHomeList', data);
            break;
          case 4:
            this.setFields('fifthDayHomeList', data);
            break;
          case 5:
            this.setFields('sixthDayHomeList', data);
            break;
          default:
            break;
        }

        this.newTodayHomeApiState = 'done';
        this.setFields('pullToRefreshNewHome', false);
      })
      .catch(err => {
        captureException(err);
        console.error('newTodayHomeApi error', err);

        this.newTodayHomeApiState = 'error';

        if (!err.response) {
          AppStore.setFailedApiList({
            className: 'TodayStore',
            functionName: 'newTodayHomeApi',
            isNetworkFailure: AppStore.isNetworkConnected,
          });
        }

        try {
          if (err.response) {
            const {status, data} = err.response;
            switch (status) {
              case 401:
                TokenStore.getRefreshToken({
                  className: this,
                  functionName: 'newTodayHomeApi',
                });
                break;

              default:
                break;
            }
          }
        } catch (error) {
          captureException(error);
          console.error('tryCatchError newTodayHomeApi', error);
        }
      });
  };

  // fetch a cards content.
  newTodayHomeContentApi = async (id, type) => {
    const url = config.V5_BASE_URL;

    await getData(`${url}emotions/content_id/${id}/content_type/${type}/`, {})
      .then(res => {
        const {data} = res.data;

        if (data) {
          this.setFields('newHomeContentObj', data);
        }
      })
      .catch(err => {
        captureException(err);
        console.error('newTodayHomeContentApi error', err);

        if (!err.response) {
          AppStore.setFailedApiList({
            className: 'TodayStore',
            functionName: 'newTodayHomeContentApi',
            isNetworkFailure: AppStore.isNetworkConnected,
          });
        }

        try {
          if (err.response) {
            const {status, data} = err.response;
            switch (status) {
              case 401:
                TokenStore.getRefreshToken({
                  className: this,
                  functionName: 'newTodayHomeContentApi',
                });
                break;

              default:
                break;
            }
          }
        } catch (error) {
          captureException(error);
          console.error('tryCatchError newTodayHomeContentApi', error);
        }
      });
  };

  // pref api are below

  fetchUserPrefListApi = async userId => {
    this.userPrefListApiState = 'pending';

    const url = config.V5_BASE_URL;

    getData(`${url}today_cluster/user-preferences`, {})
      .then(res => {
        const {data} = res.data;

        if (data.length > 0) {
          this.convertPrefsToAppFormat(data);
        }

        this.userPrefListApiState = 'done';
      })
      .catch(err => {
        captureException(err);
        console.error('fetchUserPrefListApi error', err);
        this.userPrefListApiState = 'error';

        if (!err.response) {
          AppStore.setFailedApiList({
            className: 'TodayStore',
            functionName: 'fetchUserPrefListApi',
            isNetworkFailure: AppStore.isNetworkConnected,
          });
        }

        try {
          if (err.response) {
            const {status, data} = err.response;
            switch (status) {
              case 401:
                TokenStore.getRefreshToken({
                  className: this,
                  functionName: 'fetchUserPrefListApi',
                });
                break;

              default:
                break;
            }
          }
        } catch (error) {
          captureException(error);
          console.error('tryCatchError fetchUserPrefListApi', error);
        }
      });
  };

  convertPrefsToAppFormat = serverFormat => {
    const result = [];
    // let clusterId = 1;

    for (const item of serverFormat) {
      result.push({id: item.id, title: item.title});

      for (const clusterItem of item.cluster) {
        result.push({
          id: clusterItem.id,
          title: clusterItem.title,
          status: clusterItem.status,
          label: clusterItem.label,
        });
        // clusterId++;
      }
    }
    this.setFields('userLocalPrefListData', result);
    return this.setFields('userPrefListData', result);
  };

  convertPrefsToServerFormat = appFormat => {
    const output = {
      status: true,
      data: [],
      message: 'success',
    };

    let currentCluster = null;

    for (const item of appFormat) {
      if (item.title && item.status === undefined) {
        // New category
        if (currentCluster) {
          output.data.push(currentCluster);
        }
        currentCluster = {
          id: item.id,
          title: item.title,
          cluster: [],
        };
      } else if (item.title && item.status !== undefined) {
        // New item in category
        if (currentCluster) {
          currentCluster.cluster.push({
            id: item.id,
            title: item.title,
            status: item.status,
            label: item.label,
          });
        }
      }
    }

    // Add last category
    if (currentCluster) {
      output.data.push(currentCluster);
    }

    return output;
  };

  saveUserPreferences = async () => {
    if (this.savingUserPrefernces === true) {
      return true;
    }
    this.setFields('savingUserPrefernces', true);
    const url = config.V5_BASE_URL;

    const serverFormatPrefs = this.convertPrefsToServerFormat(
      this.userPrefListData,
    );

    const dataToSend = {
      user: AppStore.evlUserId,
      preference: serverFormatPrefs.data,
    };

    postData(`${url}preferences/save`, dataToSend)
      .then(res => {
        const eventParams = {
          developer_id: AppStore.developerId,
        };

        appAnalytics('home_personalize_save', eventParams, false);
        trackMixpanelEvent('home_personalize_save', eventParams);

        // AppStore.setPersonalizeRoutine('bottom');

        this.setFields('savingUserPrefernces', false);

        this.newTodayHomeApi(0);
        this.setFields('customizeModal', false);
      })
      .catch(e => {
        captureException(e);
        this.setFields('savingUserPrefernces', false);
        if (e != null && e.response != null) {
          console.error(e.response);
          switch (e.response.status) {
            case 400:
              console.error('Error :: ', e.response.data);
              break;
            case 401:
              console.error('', e.response.data.detail);
              break;
            case 404:
              console.error('', e.response.data.guest);
              break;
          }
        }
      });
  };

  async handleHomeScreenDateWidget() {
    await AsyncStorage.getItem('showHomeScreenDateWidget').then(value => {
      if (!value) {
        // If not shown, set the state to show the popup
        this.setFields('showHomeScreenDateWidget', true);
        // Update AsyncStorage to mark that the popup has been shown
        AsyncStorage.setItem('showHomeScreenDateWidget', 'true');
      } else {
        this.setFields('showHomeScreenDateWidget', false);
      }
    });
  }

  onTaskComplete(name) {
    const reviewPopUpEventParams = {
      developer_id: AppStore.developerId,
      source: name ? name : 'Rewards',
    };

    appAnalytics('review_popup', reviewPopUpEventParams, false);
    trackMixpanelEvent('review_popup', reviewPopUpEventParams);
    showRateUsAlert(StoreReview.requestReview);
  }

  /**
   * Marks the content as complete and updates if ncessary data is provided.
   *
   * @param {*} contentDetails - JSON containing data for filtering the object, and updated content (optional)
   */
  markContentAsCompleted = (contentDetails, showConfetti = true) => {
    let todayClusters = [...toJS(this.newTodayHomeList)];

    let clusterIndex = 0;
    let clusterCardIndex = 0;
    let cardToBeUpdated = {};

    for (
      clusterIndex = 0;
      clusterIndex < todayClusters.length;
      clusterIndex++
    ) {
      let currentCluster = todayClusters[clusterIndex];
      let clusterCards = currentCluster.today_cluster;

      for (
        clusterCardIndex = 0;
        clusterCardIndex < clusterCards.length;
        clusterCardIndex++
      ) {
        let currentCard = clusterCards[clusterCardIndex];

        if (
          currentCard.today_cluster_card.id === contentDetails.content &&
          ((currentCard.label === 'new_stories' &&
            contentDetails.content_type === 'new_stories') ||
            currentCard.today_cluster_card.type === contentDetails.content_type)
        ) {
          cardToBeUpdated = currentCard;
          cardToBeUpdated.today_cluster_card.is_completed = true;
          this.setFields('showConfettiStatus', showConfetti);

          if (showConfetti) {
            EventBus.confettiEvent(contentDetails?.content_type);
          }
          // this.handleHomeScreenDateWidget();
          break;
        }
      }
      if (cardToBeUpdated?.today_cluster_card?.is_completed) {
        this.setFields('showConfettiStatus', showConfetti);
        break;
      }
    }

    EventBus.cardCompleteEvent(contentDetails?.content_type);
    this.setFields('newTodayHomeList', todayClusters);
  };

  /**
   * Subscriber function, is always fired via EventBus, whenever journal is saved.
   * @param {object containing updated journal entry} savedJournalEntry
   */
  journalEntrySaved = savedJournalEntry => {
    let todayClusters = [...toJS(this.newTodayHomeList)];

    let clusterIndex = 0;
    let clusterCardIndex = 0;
    let cardToBeUpdated = {};

    for (
      clusterIndex = 0;
      clusterIndex < todayClusters.length;
      clusterIndex++
    ) {
      let currentCluster = todayClusters[clusterIndex];
      let clusterCards = currentCluster.today_cluster;

      for (
        clusterCardIndex = 0;
        clusterCardIndex < clusterCards.length;
        clusterCardIndex++
      ) {
        let currentCard = clusterCards[clusterCardIndex];

        if (
          currentCard.today_cluster_card.type === 'new_journal' &&
          (currentCard.today_cluster_card.id === savedJournalEntry.id ||
            currentCard.today_cluster_card.id === savedJournalEntry.note) &&
          new Date(savedJournalEntry?.created_at).toLocaleDateString() ===
            new Date().toLocaleDateString()
        ) {
          cardToBeUpdated = currentCard;
          // this.handleHomeScreenDateWidget();
          cardToBeUpdated.today_cluster_card.is_completed = true;
          cardToBeUpdated.today_cluster_card.created_at =
            savedJournalEntry.created_at;
          cardToBeUpdated.today_cluster_card.id = savedJournalEntry.id;
          cardToBeUpdated.today_cluster_card.is_done = true;
          cardToBeUpdated.today_cluster_card.is_new = false;
          cardToBeUpdated.today_cluster_card.note = savedJournalEntry.note;
          cardToBeUpdated.today_cluster_card.note_id = savedJournalEntry.note;
          cardToBeUpdated.today_cluster_card.content =
            savedJournalEntry.content;
          cardToBeUpdated.today_cluster_card.voice_note =
            savedJournalEntry.voice_note;
          cardToBeUpdated.today_cluster_card.voice_note_duration =
            savedJournalEntry.voice_note_duration;

          this.setFields('showConfettiStatus', true);
          break;
        }
      }
      if (cardToBeUpdated?.today_cluster_card?.is_completed) break;
    }

    this.setFields('newTodayHomeList', todayClusters);
    //traverse the object and find the index of parent cluster, parent card, and the object
  };

  get disableSaveButton() {
    const data = toJS(this.userPrefListData);

    if (data.length > 0) {
      const findStatus = data.find((x, i) => {
        if (x.status !== undefined) {
          return x.status !== false;
        }
      });

      if (findStatus) {
        return true;
      }
    }
    return false;
  }

  onDateSelection = async dayIndex => {
    this.setFields('selectedDateTimeStamp', getTimeStamp(dayIndex));
  };

  onDisabledCardPress = card_title => {
    const daysDiff = Math.abs(
      moment()
        .startOf('day')
        .diff(moment(this.selectedDateTimeStamp).startOf('day'), 'days'),
    );

    // if (daysDiff == 1) {
    //   Toast('This content will be available tomorrow');
    // } else if (daysDiff == 2) {
    //   Toast('This content will be available in 2 days');
    // }

    switch (daysDiff) {
      case 1:
        Toast('This content will be available tomorrow');
        break;
      case 2:
        Toast('This content will be available in 2 days');
        break;
      case 3:
        Toast('This content will be available in 3 days');
        break;
      case 4:
        Toast('This content will be available in 4 days');
        break;
      case 5:
        Toast('This content will be available in 5 days');
        break;
    }

    EventBus.futureCardOpenEvent(card_title, daysDiff);
  };

  fetchActiveCourseRoutine(dayIndex) {
    const base_url = config.V7_BASE_URL;

    getData(`${base_url}journeys/today_routines/${getTimeStamp(dayIndex)}/`)
      .then(response => {
        const {data} = response || {};
        this.createTodayCardObjects(data, dayIndex);
      })
      .catch(error => {
        console.error('fetchActiveCourseRoutine', error);
        captureException(error);
      });
  }

  createTodayCardObjects(cardsData, dayIndex) {
    const cardsArray = [];

    cardsData.map(card => {
      cardsArray.push(
        new TodayCard({
          id: card?.id,
          title: card.journey?.title,
          subTitle: card.journey_step?.title,
          thumbnailImageUrl: card.journey_step?.content?.crop_thumb_image,
          cornerTitle: 'Day ' + card.journey_step?.day_no,
          contentType: card.journey_step?.content_type,
          cardData: card,
          isCompleted: card.is_completed,
          isPremium: card.journey_step?.classification !== 'free',
        }),
      );
    });

    switch (dayIndex) {
      case 0:
        this.setFields('todayCards', cardsArray);
        break;
      case 1:
        this.setFields('tomorrowCards', cardsArray);
        break;
      case 2:
        this.setFields('dayAfterTomorrowCards', cardsArray);
        break;
      case 3:
        this.setFields('fourthDay', cardsArray);
        break;
      case 4:
        this.setFields('fifthDay', cardsArray);
        break;
      case 5:
        this.setFields('sixthDay', cardsArray);
        break;
    }
  }

  markRoutineCardComplete() {
    if (!this.activeRoutineCardData) {
      return;
    }

    const base_url = config.V7_BASE_URL;
    const {journey, journey_step} = this.activeRoutineCardData || {};
    const queryParams = {
      journey: journey?.id,
      journey_day: journey_step?.journeyday?.id,
      journey_step: journey_step?.id,
    };

    postData(`${base_url}journeys/user_journey/`, queryParams)
      .then(response => {
        //mark the step complete locally
        this.todayCards?.forEach((card, index) => {
          if (this.activeRoutineCardData?.id === card?.id) {
            this.todayCards[index].isCompleted = true;
          }
        });
      })
      .catch(error => {
        try {
          if (error.response) {
            const {status} = error.response;
            switch (status) {
              case 401:
                TokenStore.getRefreshToken({
                  className: this,
                  functionName: 'markRoutineCardComplete',
                });
                break;

              default:
                break;
            }
          }
        } catch (error) {
          console.error('markRoutineCardComplete', error);
          captureException(error);
        }
      });
  }

  fetchDailyRandomQuote = async () => {
    const baseUrl = Config.V6_BASE_URL;

    let quoteTextObj = await AsyncStorage.getItem('quoteTextObj');
    quoteTextObj = JSON.parse(quoteTextObj);

    if (quoteTextObj?.date == moment().format('YYYY-MM-DD').toString()) {
      this.todayRandomQuote = quoteTextObj?.quoteText;
    } else {
      getData(`${baseUrl}random_daily_quote/`)
        .then(async res => {
          const quoteText = res?.data?.[0]?.quote_text;
          let quoteTextObj = {
            quoteText,
            date: moment().format('YYYY-MM-DD'),
          };

          if (quoteText?.length <= 10) {
            this.fetchDailyRandomQuote();
          } else {
            this.todayRandomQuote = quoteText;
            await AsyncStorage.setItem(
              'quoteTextObj',
              JSON.stringify(quoteTextObj),
            );
          }
        })
        .catch(err => {
          console.error('TodayStore- fetchDailyRandomQuote', err);
          captureException(err);
        });
    }
  };

  setTodayIllustrationIndex = async () => {
    let illustrationObj = await AsyncStorage.getItem('illustrationObj');
    illustrationObj = JSON.parse(illustrationObj);

    if (illustrationObj?.date == moment().format('YYYY-MM-DD').toString()) {
      this.todayIllustrationIndex = illustrationObj?.index;
    } else {
      let newIllustrationObj = {
        index: Math.floor(Math.random() * 10),
        date: moment().format('YYYY-MM-DD'),
      };

      this.todayIllustrationIndex = newIllustrationObj?.index;
      await AsyncStorage.setItem(
        'illustrationObj',
        JSON.stringify(newIllustrationObj),
      );
    }
  };

  categorizeTodayHomeCluster = todayHomeList => {
    let moodTracker = [];
    let journal = [];
    let meditate = [];
    let motivation = [];
    let affirmation = [];
    let gratitude = [];
    let sleepMeditation = [];

    todayHomeList.map(cluster => {
      cluster?.today_cluster?.map(card => {
        if (card.id === 32) {
          moodTracker.push(card);
        }
        if (card.id === 38) {
          journal.push(card);
        }
        if (card.label === 'audio' && card.id != 41) {
          meditate.push(card);
        }
        if (card.label === 'new_stories') {
          motivation.push(card);
        }
        if (card.label === 'affirmation') {
          affirmation.push(card);
        }
        if (card.id === 44) {
          gratitude.push(card);
        }
        if (card.id === 41) {
          sleepMeditation.push(card);
        }
      });
    });

    return [
      moodTracker,
      journal,
      meditate,
      motivation,
      affirmation,
      gratitude,
      sleepMeditation,
    ];
  };

  getCardHeight = (cardLabel, isCompleted, isMoodTracker) => {
    if (isCompleted) {
      return isMoodTracker ? 425 : 575;
    } else if (
      ['new_journal', 'new_stories', 'affirmation'].includes(cardLabel)
    ) {
      return isMoodTracker ? 446 : 1255;
    } else {
      return 781;
    }
  };

  getActiveCoursesHeight = () => {
    let height = 0;

    this.todayCards.map(card => {
      if (card.isCompleted) {
        height += 228;
      } else {
        height += 474;
      }
    });

    return height + 241;
  };

  updateTodayHomeScrollOffset = cardId => {
    let previousCardsOffset = 0;
    let currentCardsOffset = 0;
    const hRem = AppStore.wHeight / 2688;

    this.newTodayHomeList.map(cluster => {
      cluster?.today_cluster?.map(card => {
        const isMoodTracker = card?.id == 32;

        if (card?.id == cardId) {
          previousCardsOffset = currentCardsOffset;
        }
        if (isMoodTracker && this.todayCards?.length > 0) {
          currentCardsOffset += this.getActiveCoursesHeight();
        }

        currentCardsOffset += this.getCardHeight(
          card?.label,
          card?.today_cluster_card?.is_completed,
          isMoodTracker,
        );
      });
    });

    this.todayHomeScrollOffset = (previousCardsOffset + 1450) * hRem;
  };
}

export default new TodayStore();
