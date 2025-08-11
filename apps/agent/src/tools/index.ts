// Import all built-in tools
import { 
  fileWriteTool, 
  fileReadTool, 
  fileDeleteTool, 
  fileListTool 
} from './file-tools';

import { 
  commandExecuteTool, 
  commandExecuteSyncTool, 
  systemInfoTool 
} from './command-tools';

import { 
  httpRequestTool, 
  httpGetTool, 
  httpPostTool 
} from './http-tools';

import { 
  ImageAnalysisTool, 
  ImageGenerationTool, 
  OCRTool 
} from './image-tools';

import { 
  VideoGenerationTool, 
  VideoAnalysisTool, 
  VideoScriptTool 
} from './video-tools';

// Export all built-in tools
export { 
  fileWriteTool, 
  fileReadTool, 
  fileDeleteTool, 
  fileListTool 
};

export { 
  commandExecuteTool, 
  commandExecuteSyncTool, 
  systemInfoTool 
};

export { 
  httpRequestTool, 
  httpGetTool, 
  httpPostTool 
};

export { 
  ImageAnalysisTool, 
  ImageGenerationTool, 
  OCRTool 
};

export { 
  VideoGenerationTool, 
  VideoAnalysisTool, 
  VideoScriptTool 
};

// Basic tools (no dependencies)
export const builtInTools = [
  fileWriteTool,
  fileReadTool,
  fileDeleteTool,
  fileListTool,
  commandExecuteTool,
  commandExecuteSyncTool,
  systemInfoTool,
  httpRequestTool,
  httpGetTool,
  httpPostTool
];