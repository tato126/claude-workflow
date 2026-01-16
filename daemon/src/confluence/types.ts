// Confluence Cloud REST API v2 Types

export interface ConfluenceConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  spaceKey: string;
  spaceId: string;
  parentPageId?: string;  // 지정하면 해당 페이지 하위에 생성, 없으면 자동 생성
}

export interface ConfluencePage {
  id: string;
  title: string;
  status?: string;
  spaceId?: string;
  parentId?: string;
  version?: {
    number: number;
    message?: string;
  };
  body?: {
    storage?: {
      value: string;
      representation: string;
    };
  };
  _links?: {
    webui?: string;
    base?: string;
  };
}

export interface ConfluenceSearchResult {
  results: ConfluencePage[];
  _links?: {
    next?: string;
  };
}

export interface CreatePageRequest {
  spaceId: string;
  status: 'current' | 'draft';
  title: string;
  parentId?: string;
  body: {
    representation: 'storage' | 'atlas_doc_format';
    value: string;
  };
}

export interface UpdatePageRequest {
  id: string;
  status: 'current' | 'draft';
  title: string;
  body: {
    representation: 'storage' | 'atlas_doc_format';
    value: string;
  };
  version: {
    number: number;
    message?: string;
  };
}
