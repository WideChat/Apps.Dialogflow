import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { AppSetting, DefaultMessage } from '../config/Settings';
import { ActionIds } from '../enum/ActionIds';
import {  DialogflowRequestType, IDialogflowAction, IDialogflowMessage, IDialogflowPayload} from '../enum/Dialogflow';
import { closeChat, performHandover, updateRoomCustomFields } from '../lib/Room';
import { getAppSettingValue } from '../lib/Settings';
import { Dialogflow } from './Dialogflow';
import { createDialogflowMessage, createMessage } from './Message';

export const  handlePayloadActions = async (read: IRead,  modify: IModify, http: IHttp, persistence: IPersistence, rid: string, visitorToken: string, dialogflowMessage: IDialogflowMessage) => {
    const { messages = [] } = dialogflowMessage;
    for (const message of messages) {
        const { action = null } = message as IDialogflowPayload;
        if (action) {
            const { name: actionName, params } = action as IDialogflowAction;
            const targetDepartment: string = await getAppSettingValue(read, AppSetting.FallbackTargetDepartment);
            if (actionName) {
                if (actionName === ActionIds.PERFORM_HANDOVER) {
                    if (params) {
                        const customFields: any = {};
                        if (params.salesforceButtonId) {
                            customFields.reqButtonId = params.salesforceButtonId;
                        }
                        if (params.salesforceId) {
                            customFields.salesforceId = params.salesforceId;
                        }
                        if (params.customDetail) {
                            customFields.customDetail = params.customDetail;
                        }
                        if (Object.keys(customFields).length > 0) {
                            await updateRoomCustomFields(rid, customFields, read, modify);
                        }
                    }
                    await performHandover(modify, read, rid, visitorToken, targetDepartment);
                } else if (actionName === ActionIds.CLOSE_CHAT) {
                    await closeChat(modify, read, rid);
                }
                else if (actionName === ActionIds.SET_TIMEOUT) {
                    let n = setTimeout(async () => {
                        try {
                            const event = { name: params.eventName, languageCode: 'en', parameters: {} };
                            const response: IDialogflowMessage = await Dialogflow.sendRequest(http, read, modify, persistence, rid, event, DialogflowRequestType.EVENT);
                            await createDialogflowMessage(rid, read, modify, response);
                        }
                        catch (error) {

                            const serviceUnavailable: string = await getAppSettingValue(read, AppSetting.DialogflowServiceUnavailableMessage);
                    
                            await createMessage(rid,
                                                read,
                                                modify,
                                                { text: serviceUnavailable ? serviceUnavailable : DefaultMessage.DEFAULT_DialogflowServiceUnavailableMessage });
                    
                            return;
                        }
                        

                    }, Number(params.time));

                }
            }
        }
    }
}