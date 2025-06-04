import { Artifact } from '../uploader/uploader.interfaces';

import { AirdropEvent } from '../types/extraction';
import { WorkerAdapterOptions } from '../types/workers';

/**
 * RepoInterface is an interface that defines the structure of a repo which is used to store and upload extracted data.
 */
export interface RepoInterface {
  itemType: string;
  normalize?: (record: object) => NormalizedItem | NormalizedAttachment;
}

/**
 * RepoFactoryInterface is an interface that defines the structure of a repo factory which is used to create a repo.
 */
export interface RepoFactoryInterface {
  event: AirdropEvent;
  itemType: string;
  normalize?: (record: object) => NormalizedItem | NormalizedAttachment;
  onUpload: (artifact: Artifact) => void;
  options?: WorkerAdapterOptions;
}

/**
 * NormalizedItem is an interface of item after normalization.
 */
export interface NormalizedItem {
  id: string;
  created_date: string;
  modified_date: string;
  data: object;
}

/**
 * NormalizedAttachment is an interface of attachment after normalization.
 */
export interface NormalizedAttachment {
  url: string;
  id: string;
  file_name: string;
  parent_id: string;
  author_id?: string;

  // This should be a string, but it was a number in the past. Due to backwards
  // compatibility we are keeping it also as a number.
  grand_parent_id?: number | string;
}

/**
 * Item is an interface that defines the structure of an item.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Item = Record<string, any>;
