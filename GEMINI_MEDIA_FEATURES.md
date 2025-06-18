# Gemini Media Generation Features

## Overview
I've successfully implemented Gemini-specific media generation features in C3Chat, including support for image and video generation using Google's Imagen and Veo models.

## Changes Made

### 1. **Model Configuration**
- Added Imagen models (imagen-3, imagen-2) for image generation
- Added Veo model (veo-2) for video generation  
- These models appear in the model selector when Google provider is selected
- Models are marked with type indicators (Image Gen, Video Gen)

### 2. **Command Support**
- `/image <prompt>` - Generate images using Imagen models
- `/video <prompt>` - Generate videos using Veo models
- Commands only available when Google provider with media generation support is selected
- Commands dropdown dynamically shows available features based on selected provider

### 3. **UI Updates**
- Model selector shows media generation capabilities with icons
- Generated images display inline in the chat
- Generated videos display with video player controls
- Provider capabilities shown in model selection dropdown

### 4. **Implementation Details**

#### New Files:
- `convex/ai-media.ts` - Media generation actions for image and video

#### Updated Files:
- `src/lib/ai-providers.ts` - Added media models and capabilities
- `src/components/ModelSelector.tsx` - Shows model types and capabilities
- `src/components/ChatView.tsx` - Added video command and dynamic command display
- `src/components/MessageList.tsx` - Display generated videos
- `src/lib/corrected-sync-engine.tsx` - Added generateVideo action
- `src/lib/local-db.ts` - Added generatedVideoUrl to message schema
- `convex/schema.ts` - Added generatedVideoUrl to messages table
- `convex/messages.ts` - Support for generatedVideoUrl in updateContent

## Usage

1. **Select a Google Gemini model** in the model selector
2. **For image generation:**
   - Use command: `/image a beautiful sunset over mountains`
   - Or select Imagen-3 model specifically
3. **For video generation:**
   - Use command: `/video waves crashing on a beach`
   - Or select Veo-2 model specifically

## Important Notes

- Media generation requires a Google API key with appropriate permissions
- The actual Imagen and Veo APIs are in beta and may require additional setup
- Generated media is stored as base64 or URLs in the message data
- UI dynamically adapts based on selected provider capabilities

## State Management Safety

All changes were made carefully to preserve the existing state management:
- No new useEffect hooks added
- No changes to core sync logic
- Media generation uses existing action patterns
- UI updates are purely presentational

The implementation follows the existing patterns in the codebase and maintains compatibility with the fragile state management system.