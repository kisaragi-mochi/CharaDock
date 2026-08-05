cmake_minimum_required(VERSION 3.25)
project(charadock_beatrice_host LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

set(VST3_SDK_ROOT "" CACHE PATH "Path to the Steinberg VST3 SDK")
if(NOT EXISTS "${VST3_SDK_ROOT}/CMakeLists.txt")
  message(FATAL_ERROR "Set VST3_SDK_ROOT to the Steinberg VST3 SDK checkout")
endif()

set(SMTG_ENABLE_VST3_PLUGIN_EXAMPLES OFF CACHE BOOL "" FORCE)
set(SMTG_ENABLE_VST3_HOSTING_EXAMPLES OFF CACHE BOOL "" FORCE)
set(SMTG_ENABLE_VSTGUI_SUPPORT OFF CACHE BOOL "" FORCE)
add_subdirectory("${VST3_SDK_ROOT}" vst3sdk EXCLUDE_FROM_ALL)

add_executable(charadock-beatrice-host
  src/main.cpp
  "${VST3_SDK_ROOT}/public.sdk/source/common/memorystream.cpp"
  "${VST3_SDK_ROOT}/public.sdk/source/vst/hosting/module_win32.cpp"
  "${VST3_SDK_ROOT}/public.sdk/source/vst/hosting/plugprovider.cpp"
)
target_include_directories(charadock-beatrice-host PRIVATE "${VST3_SDK_ROOT}")
target_link_libraries(charadock-beatrice-host PRIVATE sdk_hosting)
if(MSVC)
  target_compile_options(charadock-beatrice-host PRIVATE /utf-8 /W4)
else()
  target_compile_options(charadock-beatrice-host PRIVATE -Wall -Wextra -Wpedantic)
  target_link_options(charadock-beatrice-host PRIVATE -municode -static -static-libgcc -static-libstdc++)
endif()

install(TARGETS charadock-beatrice-host RUNTIME DESTINATION .)
