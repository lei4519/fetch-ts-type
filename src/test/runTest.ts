/** fetchTsComment
 * @namespace TaskInfo
 * @url http://mock.api/taskinfo
 */
export namespace TaskInfo {
	export interface RootObject {
		/**
		 * hhhh
		 */
		isSuccess: boolean
		// 123
		err: Err
		data: Data
	}
	export interface Data {
		id: number
		name: string
		productName: string
		productLink: string
		productIntroduce: string
		taskAnnex: string
		settlementType: number
		servingIncomePrice: number
		platformIncomePrice: number
		orderPrice: number
		cancelServingIncomePrice: number
		projectNum: string
		coopPeriodEnd: number
		coopPeriodBegin: number
		details: string
		servingId: number
		servingName: string
		contacts: string
		contactsPhone: string
		auditStatus: string
		status: string
		productId: string
		customerId: number
		industryInfo: IndustryInfo
		auditTime: number
		rejectReason: string
		contentNum: number
		contentUnitPrice: number
		stageStatus: number
		expectReleaseTime: number
		taskAnnexName: string[]
		annexList: string[]
		taskDraftFile: string
		taskDraftName: string[]
		taskDraftList: string[]
		draftAuditTime: number
		draftRejectReason: string
		type: number
		finishTime: number
		contentUrls: string[]
	}
	export interface IndustryInfo {
		id: string
		level: string
		name: string
		parentName: string
		parentId: string
	}
	export interface Err {
		code: string
		mag: string
	}
}
