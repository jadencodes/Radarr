import _ from 'lodash';
import { createAction } from 'redux-actions';
import { batchActions } from 'redux-batched-actions';
import movieEntities from 'Movie/movieEntities';
import { createThunk, handleThunks } from 'Store/thunks';
import createAjaxRequest from 'Utilities/createAjaxRequest';
import { removeItem, set, updateItem } from './baseActions';
import createFetchHandler from './Creators/createFetchHandler';
import createHandleActions from './Creators/createHandleActions';
import createRemoveItemHandler from './Creators/createRemoveItemHandler';

//
// Variables

export const section = 'movieFiles';

//
// State

export const defaultState = {
  isFetching: false,
  isPopulated: false,
  error: null,
  isDeleting: false,
  deleteError: null,
  isSaving: false,
  saveError: null,
  items: []
};

//
// Actions Types

export const FETCH_MOVIE_FILES = 'movieFiles/fetchMovieFiles';
export const DELETE_MOVIE_FILE = 'movieFiles/deleteMovieFile';
export const DELETE_MOVIE_FILES = 'movieFiles/deleteMovieFiles';
export const UPDATE_MOVIE_FILES = 'movieFiles/updateMovieFiles';
export const CLEAR_MOVIE_FILES = 'movieFiles/clearMovieFiles';

//
// Action Creators

export const fetchMovieFiles = createThunk(FETCH_MOVIE_FILES);
export const deleteMovieFile = createThunk(DELETE_MOVIE_FILE);
export const deleteMovieFiles = createThunk(DELETE_MOVIE_FILES);
export const updateMovieFiles = createThunk(UPDATE_MOVIE_FILES);
export const clearMovieFiles = createAction(CLEAR_MOVIE_FILES);

//
// Helpers

const deleteMovieFileHelper = createRemoveItemHandler(section, '/movieFile');

//
// Action Handlers

export const actionHandlers = handleThunks({
  [FETCH_MOVIE_FILES]: createFetchHandler(section, '/movieFile'),

  [DELETE_MOVIE_FILE]: function(getState, payload, dispatch) {
    const {
      id: movieFileId,
      movieEntity = movieEntities.MOVIES
    } = payload;

    const movieSection = _.last(movieEntity.split('.'));
    const deletePromise = deleteMovieFileHelper(getState, payload, dispatch);

    deletePromise.done(() => {
      const movies = getState().movies.items;
      const moviesWithRemovedFiles = _.filter(movies, { movieFileId });

      dispatch(batchActions([
        ...moviesWithRemovedFiles.map((movie) => {
          return updateItem({
            section: movieSection,
            ...movie,
            movieFileId: 0,
            hasFile: false
          });
        })
      ]));
    });
  },

  [DELETE_MOVIE_FILES]: function(getState, payload, dispatch) {
    const {
      movieFileIds
    } = payload;

    dispatch(set({ section, isDeleting: true }));

    const promise = createAjaxRequest({
      url: '/movieFile/bulk',
      method: 'DELETE',
      dataType: 'json',
      data: JSON.stringify({ movieFileIds })
    }).request;

    promise.done(() => {
      const movies = getState().movies.items;
      const moviesWithRemovedFiles = movieFileIds.reduce((acc, movieFileId) => {
        acc.push(..._.filter(movies, { movieFileId }));

        return acc;
      }, []);

      dispatch(batchActions([
        ...movieFileIds.map((id) => {
          return removeItem({ section, id });
        }),

        ...moviesWithRemovedFiles.map((movie) => {
          return updateItem({
            section: 'movies',
            ...movie,
            movieFileId: 0,
            hasFile: false
          });
        }),

        set({
          section,
          isDeleting: false,
          deleteError: null
        })
      ]));
    });

    promise.fail((xhr) => {
      dispatch(set({
        section,
        isDeleting: false,
        deleteError: xhr
      }));
    });
  },

  [UPDATE_MOVIE_FILES]: function(getState, payload, dispatch) {

    const {
      movieFileIds,
      languages,
      indexerFlags,
      quality,
      edition,
      releaseGroup
    } = payload;

    dispatch(set({ section, isSaving: true }));

    const requestData = {
      movieFileIds
    };

    if (languages) {
      requestData.languages = languages;
    }

    if (indexerFlags !== undefined) {
      requestData.indexerFlags = indexerFlags;
    }

    if (quality) {
      requestData.quality = quality;
    }

    if (releaseGroup !== undefined) {
      requestData.releaseGroup = releaseGroup;
    }

    if (edition !== undefined) {
      requestData.edition = edition;
    }

    const promise = createAjaxRequest({
      url: '/movieFile/editor',
      method: 'PUT',
      dataType: 'json',
      data: JSON.stringify(requestData)
    }).request;

    promise.done((data) => {
      dispatch(batchActions([
        ...movieFileIds.map((id) => {
          const props = {};

          const movieFile = data.find((file) => file.id === id);

          props.qualityCutoffNotMet = movieFile.qualityCutoffNotMet;

          if (languages) {
            props.languages = languages;
          }

          if (indexerFlags) {
            props.indexerFlags = indexerFlags;
          }

          if (quality) {
            props.quality = quality;
          }

          if (edition !== undefined) {
            props.edition = edition;
          }

          if (releaseGroup !== undefined) {
            props.releaseGroup = releaseGroup;
          }

          return updateItem({ section, id, ...props });
        }),

        set({
          section,
          isSaving: false,
          saveError: null
        })
      ]));
    });

    promise.fail((xhr) => {
      dispatch(set({
        section,
        isSaving: false,
        saveError: xhr
      }));
    });
  }
});

//
// Reducers

export const reducers = createHandleActions({

  [CLEAR_MOVIE_FILES]: (state) => {
    return Object.assign({}, state, defaultState);
  }

}, defaultState, section);
