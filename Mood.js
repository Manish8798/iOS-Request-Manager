import {action, computed, observable, toJS, makeObservable} from 'mobx';
import Config from 'react-native-config';
import {captureException} from '@sentry/react-native';

class Mood {
  userNoteId = null;
  id = null; //user mood Id
  emoji_name = null;
  emoji = null;
  created_at = null;

  constructor(userNoteId, id, emoji_name, emoji, created_at) {
    this.userNoteId = userNoteId;
    this.id = id;
    this.emoji_name = emoji_name;
    this.emoji = emoji;
    this.created_at = created_at;

    makeObservable(this, {
      userNoteId: observable,
      id: observable,
      emoji_name: observable,
      emoji: observable,
      created_at: observable,
    });
  }
}

export default Mood;
