const log4js = require('log4js');
const log = log4js.getLogger('VisitorCheck');
const axios = require('axios');
const query = require('../../config/mysql.config');

class VisitorCheck {

    constructor() {
        this.logger = log;
        this.query = query;
    }

    async updateVisitorStatus() {
        try {
            let expiredVistors = await this.getExpiredVistors();
            for(let visitor of expiredVistors) {
                await this.unbindVistorFromGroup(visitor);
                await this.deleteVisitor(visitor);
            }
        } catch (error) {
            await this.logger.error(__filename+' updateVisitorStatus(): '+error);
        }
    }

    async getExpiredVistors() {
        try {
            let querySQL = 'SELECT user.id as employee_id, user.name, user.type as member_type, user.org_auth_key, user_access.group_id as group_id, proj.prj_auth_key '+
                'FROM `fa_employee_user` user JOIN `fa_employee_group_access` user_access ON user.id = user_access.employee_id JOIN `fa_proj_lst` proj ON user.org_auth_key = proj.org_auth_key '+
                'WHERE user.type = 1 AND user_access.time_to < unix_timestamp(CURRENT_TIMESTAMP);';
            let expiredVistors = await this.query(querySQL);
            // console.log('expired visitors: ' + JSON.stringify(expiredVistors));
            // this.logger.info('expired visitors: ' + JSON.stringify(expiredVistors));
            return expiredVistors;
        } catch (error) {
            await this.logger.error(__filename+' getExpiredVistors(): '+error);
        }
    }

    async unbindVistorFromGroup(visitor) {
        try {
            let path = '/addons/company/api.openinterface/UnbindPersonFromGroup';
            let postBody = {
                "prj_auth_key":visitor.prj_auth_key,
                "member_id":visitor.employee_id,
                "member_type":visitor.member_type,
                "group_id":visitor.group_id - 2
            };
            await axios.post(path, postBody);
        } catch (error) {
            await this.logger.error(__filename+' unbindVistorFromGroup(): '+error);
        }
    }

    async deleteVisitor(visitor) {
        try {
            let path = '/addons/company/api.openinterface/DeleteVisitorData';
            let postBody = {
                "org_auth_key":visitor.org_auth_key,
                "visitor_id":visitor.employee_id
            };
            await axios.post(path, postBody);
        } catch (error) {
            await this.logger.error(__filename+' deleteVisitor(): '+error);
        }
    }

    async startVistorCheck() {
        await this.updateVisitorStatus();
        await new Promise(resolve => setTimeout(resolve, 5000));
        await this.startVistorCheck();
    }
}

module.exports = VisitorCheck;