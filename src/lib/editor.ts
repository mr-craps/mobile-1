import {
  ContentType,
  PayloadSource,
  removeFromArray,
  SNNote,
  TagMutator,
  UuidString,
} from '@standardnotes/snjs';
import { MobileApplication } from './application';

export type EditorNoteChangeObserver = (note: SNNote) => void;
export type EditorNoteValueChangeObserver = (
  note: SNNote,
  source?: PayloadSource
) => void;

export class Editor {
  public note?: SNNote;
  private noteChangeObservers: EditorNoteChangeObserver[] = [];
  private noteValueChangeObservers: EditorNoteValueChangeObserver[] = [];
  private removeStreamObserver?: () => void;
  public isTemplateNote = false;

  constructor(private application: MobileApplication) {}

  async init(noteUuid?: string, noteTitle?: string, noteTagUuid?: UuidString) {
    if (noteUuid) {
      this.note = this.application?.findItem(noteUuid) as SNNote;
    } else {
      await this.reset(noteTitle, noteTagUuid);
    }

    this.removeStreamObserver = this.application?.streamItems(
      ContentType.Note,
      (items, source) => {
        this.handleNoteStream(items as SNNote[], source);
      }
    );
  }

  deinit() {
    if (this.removeStreamObserver) {
      this.removeStreamObserver();
    }
    this.removeStreamObserver = undefined;
    this.noteChangeObservers.length = 0;
    this.noteValueChangeObservers.length = 0;
    (this.application as unknown) = undefined;
  }

  private handleNoteStream(notes: SNNote[], source?: PayloadSource) {
    /** Update our note object reference whenever it changes */
    const matchingNote = notes.find(item => {
      return item.uuid === this.note?.uuid;
    }) as SNNote;

    if (matchingNote) {
      this.isTemplateNote = false;
      this.note = matchingNote;
      this.onNoteValueChange(matchingNote, source);
    }
  }

  async insertTemplatedNote() {
    return this.application?.insertItem(this.note!);
  }

  /**
   * Reverts the editor to a blank state, removing any existing note from view,
   * and creating a placeholder note.
   */
  async reset(noteTitle?: string, noteTagUuid?: UuidString) {
    const note = await this.application?.createTemplateItem(ContentType.Note, {
      text: '',
      title: noteTitle || '',
      references: [],
    });
    if (noteTagUuid) {
      await this.application.changeItem<TagMutator>(noteTagUuid, m => {
        m.addItemAsRelationship(note);
      });
    }
    this.setNote(note as SNNote, true);
  }

  private onNoteChange(note: SNNote) {
    if (note) {
      for (const observer of this.noteChangeObservers) {
        observer(note);
      }
    }
  }

  /**
   * Registers an observer for Editor note change
   * @returns function that unregisters this observer
   */
  public addNoteChangeObserver(callback: EditorNoteChangeObserver) {
    this.noteChangeObservers.push(callback);
    return () => {
      removeFromArray(this.noteChangeObservers, callback);
    };
  }

  /**
   * Registers an observer for Editor note's value changes (and thus a new object reference is created)
   * @returns function that unregisters this observer
   */
  public addNoteValueChangeObserver(callback: EditorNoteValueChangeObserver) {
    this.noteValueChangeObservers.push(callback);
    return () => {
      removeFromArray(this.noteValueChangeObservers, callback);
    };
  }

  private onNoteValueChange(note: SNNote, source?: PayloadSource) {
    for (const observer of this.noteValueChangeObservers) {
      observer(note, source);
    }
  }

  /**
   * Sets the editor contents by setting its note.
   */
  public setNote(note: SNNote, isTemplate = false) {
    this.note = note;
    this.isTemplateNote = isTemplate;
    this.onNoteChange(this.note);
  }
}
