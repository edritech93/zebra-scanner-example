import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, NativeEventEmitter, TouchableOpacity } from 'react-native';
import {CheckBox, Button} from 'react-native-elements'
import DataWedgeIntents from 'react-native-datawedge-intents';

const eventEmitter = new NativeEventEmitter();

export default function App(props) {
    const [loading, setLoading] = useState(false);
    const [ean8checked, setean8checked] = useState(true);
    const [ean13checked, setean13checked] = useState(true);
    const [code39checked, setcode39checked] = useState(true);
    const [code128checked, setcode128checked] = useState(true);
    const [lastApiVisible, setlastApiVisible] = useState(false);
    const [lastApiText, setlastApiText] = useState("Messages from DataWedge will go here");
    const [checkBoxesDisabled, setcheckBoxesDisabled] = useState(true);
    const [scanButtonVisible, setscanButtonVisible] = useState(false);
    const [dwVersionText, setdwVersionText] = useState("Pre 6.3.  Please create and configure profile manually.  See the ReadMe for more details");
    const [dwVersionTextStyle, setdwVersionTextStyle] = useState(styles.itemTextAttention);
    const [activeProfileText, setactiveProfileText] = useState("Requires DataWedge 6.3+");
    const [enumeratedScannersText, setenumeratedScannersText] = useState("Requires DataWedge 6.3+");
    const [scans, setscans] = useState([]);
    const [sendCommandResult, setsendCommandResult] = useState(false);

    useEffect(() => {
        const subscription = eventEmitter.addListener('datawedge_broadcast_intent', (intent) => broadcastReceiver(intent));
        registerBroadcastReceiver();
        setTimeout(() => {
            determineVersion();
        }, 500);
        return () => {
            subscription.remove();
        };
    }, [])

    function _onPressScanButton() {
        sendCommand("com.symbol.datawedge.api.SOFT_SCAN_TRIGGER", 'TOGGLE_SCANNING');
    }

    function determineVersion() {
        sendCommand("com.symbol.datawedge.api.GET_VERSION_INFO", "");
    }

    function setDecoders() {
        //  Set the new configuration
        var profileConfig = {
            "PROFILE_NAME": "ZebraReactNativeDemo",
            "PROFILE_ENABLED": "true",
            "CONFIG_MODE": "UPDATE",
            "PLUGIN_CONFIG": {
                "PLUGIN_NAME": "BARCODE",
                "PARAM_LIST": {
                    //"current-device-id": selectedScannerId,
                    "scanner_selection": "auto",
                    "decoder_ean8": "" + ean8checked,
                    "decoder_ean13": "" + ean13checked,
                    "decoder_code128": "" + code128checked,
                    "decoder_code39": "" + code39checked
                }
            }
        };
        sendCommand("com.symbol.datawedge.api.SET_CONFIG", profileConfig);
    }

    function sendCommand(extraName, extraValue) {
        console.log("Sending Command: " + extraName + ", " + JSON.stringify(extraValue));
        var broadcastExtras = {};
        broadcastExtras[extraName] = extraValue;
        broadcastExtras["SEND_RESULT"] = sendCommandResult;
        DataWedgeIntents.sendBroadcastWithExtras({
            action: "com.symbol.datawedge.api.ACTION",
            extras: broadcastExtras
        });
    }

    function registerBroadcastReceiver() {
        DataWedgeIntents.registerBroadcastReceiver({
            filterActions: [
                'com.zebra.reactnativedemo.ACTION',
                'com.symbol.datawedge.api.RESULT_ACTION'
            ],
            filterCategories: [
                'android.intent.category.DEFAULT'
            ]
        });
    }

    function broadcastReceiver(intent) {
        //  Broadcast received
        console.log('Received Intent: ' + JSON.stringify(intent));
        if (intent.hasOwnProperty('RESULT_INFO')) {
            var commandResult = intent.RESULT + " (" +
                intent.COMMAND.substring(intent.COMMAND.lastIndexOf('.') + 1, intent.COMMAND.length) + ")";// + JSON.stringify(intent.RESULT_INFO);
            commandReceived(commandResult.toLowerCase());
        }
        if (intent.hasOwnProperty('com.symbol.datawedge.api.RESULT_GET_VERSION_INFO')) {
            //  The version has been returned (DW 6.3 or higher).  Includes the DW version along with other subsystem versions e.g MX  
            var versionInfo = intent['com.symbol.datawedge.api.RESULT_GET_VERSION_INFO'];
            console.log('Version Info: ' + JSON.stringify(versionInfo));
            var datawedgeVersion = versionInfo['DATAWEDGE'];
            console.log("Datawedge version: " + datawedgeVersion);

            //  Fire events sequentially so the application can gracefully degrade the functionality available on earlier DW versions
            if (datawedgeVersion >= "06.3") {
                datawedge63();
            }
            if (datawedgeVersion >= "06.4") {
                datawedge64();
            }
            if (datawedgeVersion >= "06.5") {
                datawedge65();
            }
        }
        else if (intent.hasOwnProperty('com.symbol.datawedge.api.RESULT_ENUMERATE_SCANNERS')) {
            //  Return from our request to enumerate the available scanners
            var enumeratedScannersObj = intent['com.symbol.datawedge.api.RESULT_ENUMERATE_SCANNERS'];
            enumerateScanners(enumeratedScannersObj);
        }
        else if (intent.hasOwnProperty('com.symbol.datawedge.api.RESULT_GET_ACTIVE_PROFILE')) {
            //  Return from our request to obtain the active profile
            var activeProfileObj = intent['com.symbol.datawedge.api.RESULT_GET_ACTIVE_PROFILE'];
            activeProfile(activeProfileObj);
        }
        else if (!intent.hasOwnProperty('RESULT_INFO')) {
            //  A barcode has been scanned
            barcodeScanned(intent, new Date().toLocaleString());
        }
    }

    function datawedge63() {
        console.log("Datawedge 6.3 APIs are available");
        //  Create a profile for our application
        sendCommand("com.symbol.datawedge.api.CREATE_PROFILE", "ZebraReactNativeDemo");
        setdwVersionText("6.3.  Please configure profile manually.  See ReadMe for more details.")

        //  Although we created the profile we can only configure it with DW 6.4.
        sendCommand("com.symbol.datawedge.api.GET_ACTIVE_PROFILE", "");

        //  Enumerate the available scanners on the device
        sendCommand("com.symbol.datawedge.api.ENUMERATE_SCANNERS", "");

        //  Functionality of the scan button is available
        setscanButtonVisible(true)

    }

    function datawedge64() {
        console.log("Datawedge 6.4 APIs are available");

        //  Documentation states the ability to set a profile config is only available from DW 6.4.
        //  For our purposes, this includes setting the decoders and configuring the associated app / output params of the profile.
        setdwVersionText("6.4.")
        setdwVersionTextStyle(styles.itemText)
        //document.getElementById('info_datawedgeVersion').classList.remove("attention");

        //  Decoders are now available
        setcheckBoxesDisabled(false)

        //  Configure the created profile (associated app and keyboard plugin)
        var profileConfig = {
            "PROFILE_NAME": "ZebraReactNativeDemo",
            "PROFILE_ENABLED": "true",
            "CONFIG_MODE": "UPDATE",
            "PLUGIN_CONFIG": {
                "PLUGIN_NAME": "BARCODE",
                "RESET_CONFIG": "true",
                "PARAM_LIST": {}
            },
            "APP_LIST": [{
                "PACKAGE_NAME": "com.zebrascannerapp",
                "ACTIVITY_LIST": ["*"]
            }]
        };
        sendCommand("com.symbol.datawedge.api.SET_CONFIG", profileConfig);

        //  Configure the created profile (intent plugin)
        var profileConfig2 = {
            "PROFILE_NAME": "ZebraReactNativeDemo",
            "PROFILE_ENABLED": "true",
            "CONFIG_MODE": "UPDATE",
            "PLUGIN_CONFIG": {
                "PLUGIN_NAME": "INTENT",
                "RESET_CONFIG": "true",
                "PARAM_LIST": {
                    "intent_output_enabled": "true",
                    "intent_action": "com.zebra.reactnativedemo.ACTION",
                    "intent_delivery": "2"
                }
            }
        };
        sendCommand("com.symbol.datawedge.api.SET_CONFIG", profileConfig2);

        //  Give some time for the profile to settle then query its value
        setTimeout(() => {
            sendCommand("com.symbol.datawedge.api.GET_ACTIVE_PROFILE", "");
        }, 1000);
    }

    function datawedge65() {
        console.log("Datawedge 6.5 APIs are available");
        setdwVersionText("6.5 or higher.")

        //  Instruct the API to send 
        setsendCommandResult("true")

        setlastApiVisible(true)
    }

    function commandReceived(commandText) {
        setlastApiText(commandText)
    }

    function enumerateScanners(enumeratedScanners) {
        var humanReadableScannerList = "";
        for (var i = 0; i < enumeratedScanners.length; i++) {
            console.log("Scanner found: name= " + enumeratedScanners[i].SCANNER_NAME + ", id=" + enumeratedScanners[i].SCANNER_INDEX + ", connected=" + enumeratedScanners[i].SCANNER_CONNECTION_STATE);
            humanReadableScannerList += enumeratedScanners[i].SCANNER_NAME;
            if (i < enumeratedScanners.length - 1)
                humanReadableScannerList += ", ";
        }
        setenumeratedScannersText(humanReadableScannerList)
    }

    function activeProfile(theActiveProfile) {
        setactiveProfileText(theActiveProfile)
    }

    function barcodeScanned(scanData, timeOfScan) {
        var scannedData = scanData["com.symbol.datawedge.data_string"];
        var scannedType = scanData["com.symbol.datawedge.label_type"];
        console.log("Scan: " + scannedData);
        const arrayUpdate = [...scans]
        arrayUpdate.push({
            data: scannedData, 
            decoder: scannedType, 
            timeAtDecode: timeOfScan
        })
        setscans(arrayUpdate)
    }

    useEffect(() => {
      setDecoders()
    }, [ean8checked, ean13checked, code39checked, code128checked])

    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }}>
                <Text style={styles.h1}>Zebra ReactNative DataWedge Demo</Text>
                <Text style={styles.h3}>Information / Configuration</Text>
                <Text style={styles.itemHeading}>DataWedge version:</Text>
                <Text style={dwVersionTextStyle}>{dwVersionText}</Text>
                <Text style={styles.itemHeading}>Active Profile</Text>
                <Text style={styles.itemText}>{activeProfileText}</Text>
                {lastApiVisible &&
                    <Text style={styles.itemHeading}>Last API message</Text>
                }
                {lastApiVisible &&
                    <Text style={styles.itemText}>{lastApiText}</Text>
                }
                <Text style={styles.itemHeading}>Available scanners:</Text>
                <Text style={styles.itemText}>{enumeratedScannersText}</Text>
                <View style={{ flexDirection: 'row', flex: 1 }}>
                    <CheckBox
                        title={'EAN 8'}
                        checked={ean8checked}
                        disabled={checkBoxesDisabled}
                        onPress={() => setean8checked(!ean8checked)}
                    />
                    <CheckBox
                        title={'EAN 13'}
                        checked={ean13checked}
                        disabled={checkBoxesDisabled}
                        onPress={() => setean13checked(!ean13checked)}
                    />
                </View>
                <View style={{ flexDirection: 'row', flex: 1 }}>
                    <CheckBox
                        title={'Code 39'}
                        checked={code39checked}
                        disabled={checkBoxesDisabled}
                        onPress={() => setcode39checked(!code39checked)}
                    />
                    <CheckBox
                        title={'Code 128'}
                        checked={code128checked}
                        disabled={checkBoxesDisabled}
                        onPress={() => setcode128checked(!code128checked)}
                    />
                </View>
                {scanButtonVisible &&
                    <Button
                        title='Scan'
                        color="#333333"
                        buttonStyle={{
                            backgroundColor: "#ffd200",
                            height: 45,
                            borderColor: "transparent",
                            borderWidth: 0,
                            borderRadius: 5,
                        }}
                        onPress={() => _onPressScanButton()}
                    />
                }

                <Text style={styles.itemHeading}>Scanned barcodes will be displayed here:</Text>

                {scans.map((item, index) => (
                    <TouchableOpacity key={index}
                        style={{
                            backgroundColor: 'red',
                            margin: 10,
                            borderRadius: 5,
                        }}>
                        <View style={{ flexDirection: 'row', flex: 1 }}>
                            <Text style={styles.scanDataHead}>{item.decoder}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.scanDataHeadRight}>{item.timeAtDecode}</Text>
                            </View>
                        </View>
                        <Text style={styles.scanData}>{item.data}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5FCFF',
    },
    instructions: {
        textAlign: 'center',
        color: '#333333',
        marginBottom: 5,
    },
    h1: {
        fontSize: 20,
        textAlign: 'center',
        margin: 5,
        fontWeight: "bold",
    },
    h3: {
        fontSize: 14,
        textAlign: 'center',
        margin: 10,
        fontWeight: "bold",
    },
    itemHeading: {
        fontSize: 12,
        textAlign: 'left',
        left: 10,
        fontWeight: "bold",
    },
    itemText: {
        fontSize: 12,
        textAlign: 'left',
        margin: 10,
    },
    itemTextAttention: {
        fontSize: 12,
        textAlign: 'left',
        margin: 10,
        backgroundColor: '#ffd200'
    },
    scanDataHead: {
        fontSize: 10,
        margin: 2,
        fontWeight: "bold",
        color: 'white',
    },
    scanDataHeadRight: {
        fontSize: 10,
        margin: 2,
        textAlign: 'right',
        fontWeight: "bold",
        color: 'white',
    },
    scanData: {
        fontSize: 16,
        fontWeight: "bold",
        textAlign: 'center',
        margin: 2,
        color: 'white',
    }
});