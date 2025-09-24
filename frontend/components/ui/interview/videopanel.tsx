import React from "react";

interface VideoPanelProps {
  camStream:    MediaStream | null;
  screenStream: MediaStream | null;
  startCam:     () => Promise<void>; 
  startScreen:  () => Promise<void>;
  camRef:       React.RefObject<HTMLVideoElement | null>;
  screenRef:    React.RefObject<HTMLVideoElement | null>;
}

export const VideoPanel: React.FC<VideoPanelProps> = ({
  camStream,
  screenStream,
  startScreen,
  startCam,    
  camRef,
  screenRef,
}) => {
  const panels = [
    { 
      label: "Camera & Mic", 
      stream: camStream, 
      onClick: startCam,
      color: "blue",
      icon: "🎥",
      description: "Your camera feed"
    },
    { 
      label: "Screen Share", 
      stream: screenStream, 
      onClick: startScreen, 
      color: "emerald",
      icon: "🖥️",
      description: "Share your screen"
    },
  ];

  return (
    <div className="grid md:grid-cols-2 grid-cols-1 gap-8 mb-8">
      {panels.map(({ label, stream, onClick, color, icon, description }) => (
        <div 
          key={label} 
          className={`
            relative p-6 bg-gradient-to-br from-white to-gray-50 
            border border-gray-200 rounded-2xl shadow-lg hover:shadow-xl 
            transition-all duration-300 transform hover:-translate-y-1
            ${stream ? 'ring-2 ring-green-400 ring-opacity-50' : ''}
          `}
        >
          {/* Status Badge */}
          <div className="absolute top-4 right-4 z-10">
            <div className={`
              flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium
              ${stream 
                ? 'bg-green-100 text-green-700 border border-green-200' 
                : 'bg-gray-100 text-gray-600 border border-gray-200'
              }
            `}>
              <div className={`
                w-2 h-2 rounded-full animate-pulse
                ${stream ? 'bg-green-500' : 'bg-gray-400'}
              `} />
              {stream ? 'Active' : 'Inactive'}
            </div>
          </div>

          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{icon}</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{label}</h3>
                <p className="text-sm text-gray-500">{description}</p>
              </div>
            </div>
          </div>

          {/* Video Container */}
          <div className={`
            relative mb-4 rounded-xl overflow-hidden
            ${stream ? 'ring-2 ring-gray-200' : 'border-2 border-dashed border-gray-300'}
            transition-all duration-300
          `}>
            <video
              ref={label === "Camera & Mic" ? camRef : screenRef}
              autoPlay
              muted={label !== "Camera & Mic"}
              className={`
                w-full h-48 bg-gradient-to-br from-gray-900 to-gray-800
                ${stream ? 'object-cover' : 'object-contain'}
              `}
            />
            
            {/* Overlay when no stream */}
            {!stream && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90">
                <div className="text-center">
                  <div className="text-4xl mb-2 opacity-50">{icon}</div>
                  <p className="text-gray-500 font-medium">No {label.toLowerCase()} detected</p>
                </div>
              </div>
            )}

            {/* Live indicator */}
            {stream && (
              <div className="absolute top-3 left-3">
                <div className="flex items-center gap-2 px-2 py-1 bg-red-500 text-white text-xs font-medium rounded">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  LIVE
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          <button
            onClick={onClick}
            disabled={!!stream}
            className={`
              w-full px-6 py-3 rounded-xl font-medium text-white
              focus:outline-none focus:ring-4 focus:ring-opacity-50
              transition-all duration-300 transform active:scale-95
              ${stream 
                ? 'bg-green-500 cursor-not-allowed opacity-75' 
                : color === 'blue' 
                  ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400 hover:shadow-lg' 
                  : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-400 hover:shadow-lg'
              }
              ${!stream ? 'hover:-translate-y-0.5' : ''}
            `}
          >
            <div className="flex items-center justify-center gap-2">
              {stream ? (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {label} Active
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Start {label}
                </>
              )}
            </div>
          </button>

          {/* Additional Info */}
          <div className="mt-3 text-center">
            <p className="text-xs text-gray-400">
              {stream 
                ? `${label} is running smoothly` 
                : `Click to activate ${label.toLowerCase()}`
              }
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};