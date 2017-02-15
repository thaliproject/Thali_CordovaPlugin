#!/bin/sh

XCTEST_IPHONEOS=/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/Library/Frameworks/XCTest.framework
XCTEST_IPHONESIMULATOR=/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/Library/Frameworks/XCTest.framework
XCTEST_PROJECT_NAME=XCTest

FRAMEWORKS_FOLDER_DIR=${BUILT_PRODUCTS_DIR}/${FRAMEWORKS_FOLDER_PATH}
UNIVERSAL_OUTPUTFOLDER=${FRAMEWORKS_FOLDER_DIR}

# make sure the output directory exists
mkdir -p "${UNIVERSAL_OUTPUTFOLDER}"

# Step 1. Copy the XCTest framework structure (from iphoneos build) to the universal folder
cp -R "${XCTEST_IPHONEOS}" "${UNIVERSAL_OUTPUTFOLDER}/"

# Step 2. Create universal binary file using lipo and place the combined executable in the copied framework directory
lipo -create -output "${UNIVERSAL_OUTPUTFOLDER}/${XCTEST_PROJECT_NAME}.framework/${XCTEST_PROJECT_NAME}" "${XCTEST_IPHONEOS}/${XCTEST_PROJECT_NAME}" "${XCTEST_IPHONESIMULATOR}/${XCTEST_PROJECT_NAME}"
