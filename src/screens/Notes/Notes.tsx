import { AppStateType } from '@Lib/ApplicationState';
import { useFocusEffect } from '@react-navigation/native';
import { ApplicationContext } from '@Root/ApplicationContext';
import { ICON_ADD } from '@Style/icons';
import { StyleKit } from '@Style/StyleKit';
import React, { useCallback, useContext, useState } from 'react';
import FAB from 'react-native-fab';
import {
  CollectionSort,
  ContentType,
  Platform,
  SNNote,
  SNSmartTag,
} from 'snjs';
import { ThemeContext } from 'styled-components/native';
import { NoteList } from './NoteList';
import { StyledIcon } from './Notes.styled';
import { notePassesFilter } from './utils';

type Props = {
  onNoteSelect: (noteUuid: SNNote['uuid']) => void;
  onNoteCreate: () => void;
};

export const Notes: React.FC<Props> = props => {
  // Context
  const application = useContext(ApplicationContext);
  const theme = useContext(ThemeContext);

  // State
  const [sortBy] = useState<CollectionSort>(CollectionSort.UpdatedAt);
  const [sortReverse] = useState<string>();
  const [notes, setNotes] = useState<SNNote[]>([]);

  const reloadNotes = useCallback(() => {
    const tag = application!.getAppState().selectedTag;
    if (!tag) {
      return;
    }

    setNotes(application!.getDisplayableItems(ContentType.Note) as SNNote[]);
  }, [application]);

  /**
   * Note that reloading display options destroys the current index and rebuilds it,
   * so call sparingly. The runtime complexity of destroying and building
   * an index is roughly O(n^2).
   */
  const reloadNotesDisplayOptions = useCallback(() => {
    const tag = application!.getAppState().selectedTag!;
    application!.setDisplayOptions(
      ContentType.Note,
      sortBy! as CollectionSort,
      sortReverse! ? 'asc' : 'dsc',
      (note: SNNote) => {
        const matchesTag = tag.isSmartTag()
          ? note.satisfiesPredicate((tag as SNSmartTag).predicate)
          : tag.hasRelationshipWithItem(note);

        return (
          matchesTag &&
          notePassesFilter(
            note,
            application?.getAppState().selectedTag!,
            false, // application?.getAppState().showArchived!,
            false, // application?.getAppState().hidePinned!,
            '' // application?.getAppState().noteFilter.text.toLowerCase()
          )
        );
      }
    );
  }, [application, sortBy, sortReverse]);

  const streamNotesAndTags = useCallback(() => {
    const removeStreamNotes = application!.streamItems(
      [ContentType.Note],
      async () => {
        // const tempNotes = items as SNNote[];
        /** If a note changes, it will be queried against the existing filter;
         * we dont need to reload display options */
        reloadNotes();
        // const activeNote = application!.editorGroup.activeEditor.note;
        // if (activeNote) {
        //   const discarded = activeNote.deleted || activeNote.trashed;
        //   if (discarded) {
        //     this.selectNextOrCreateNew();
        //   }
        // } else {
        //   this.selectFirstNote();
        // }
      }
    );

    const removeStreamTags = application!.streamItems(
      [ContentType.Tag],
      async () => {
        // const tags = items as SNTag[];
        /** A tag could have changed its relationships, so we need to reload the filter */
        reloadNotesDisplayOptions();
        reloadNotes();
        // if (findInArray(tags, 'uuid', this.appState.selectedTag?.uuid)) {
        //   /** Tag title could have changed */
        //   this.reloadPanelTitle();
        // }
      }
    );

    return () => {
      removeStreamNotes();
      removeStreamTags();
    };
  }, [application, reloadNotes, reloadNotesDisplayOptions]);

  useFocusEffect(
    useCallback(() => {
      const removeAppStateChangeHandler = application!
        .getAppState()
        .addStateChangeObserver(state => {
          if (state === AppStateType.TagChanged) {
            reloadNotesDisplayOptions();
            reloadNotes();
          }
        });
      const removeStreams = streamNotesAndTags();

      return () => {
        removeAppStateChangeHandler();
        removeStreams();
      };
    }, [
      application,
      reloadNotes,
      reloadNotesDisplayOptions,
      streamNotesAndTags,
    ])
  );

  return (
    <>
      {/* @ts-ignore TODO: fix notelist */}
      <NoteList
        // onRefresh={this._onRefresh.bind(this)}
        // hasRefreshControl={!Auth.get().offline()}
        onPressItem={props.onNoteSelect}
        // refreshing={this.state.refreshing}
        // onSearchChange={this.onSearchTextChange}
        // onSearchCancel={this.onSearchCancel}
        notes={notes}
        // sortType={this.options.sortBy}
        // decrypting={this.state.decrypting}
        // loading={this.state.loading}
        // selectedTags={this.state.tags}
        selectedNoteId={
          application?.getAppState().isInTabletMode
            ? null // selectedNoteId
            : null
        }
      />
      <FAB
        // @ts-ignore style prop does not exist for types
        style={
          application?.getAppState().isInTabletMode
            ? { bottom: application?.getAppState().getKeyboardHeight() }
            : undefined
        }
        buttonColor={theme.stylekitInfoColor}
        iconTextColor={theme.stylekitInfoContrastColor}
        onClickAction={props.onNoteCreate}
        visible={true}
        size={30}
        paddingTop={application!.platform === Platform.Ios ? 1 : 0}
        iconTextComponent={
          <StyledIcon
            testID="newNoteButton"
            name={StyleKit.nameForIcon(ICON_ADD)}
          />
        }
      />
    </>
  );
};
