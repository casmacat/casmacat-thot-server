/*
 *   Copyright 2012, valabau
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 * 
 * socketio-handler.cpp
 *
 *  Created on: 26/03/2012
 *      Author: valabau
 */




#include <ostream>
#include <iostream>
#include <boost/algorithm/string/replace.hpp>
#include <libjson/libjson.h>

#include "socketio-handler.h"


using websocketpp::server;

namespace casmacat {

void socketio_server_handler::validate(connection_ptr con) {
    std::stringstream err;

    // We only know about the chat resource
    if (con->get_resource() != resource_name_) {
        err << "Request for unknown resource " << con->get_resource();
        throw(websocketpp::http::exception(err.str(),websocketpp::http::status_code::NOT_FOUND));
    }

}


void socketio_server_handler::on_open(connection_ptr con) {
    std::cout << "client " << con << " joined the lobby." << std::endl;
    connections_.insert(std::pair<connection_ptr,std::string>(con, get_con_id(con)));
}

void socketio_server_handler::on_close(connection_ptr con) {
    std::map<connection_ptr,std::string>::iterator it = connections_.find(con);

    if (it == connections_.end()) {
        // this client has already disconnected, we can ignore this.
        // this happens during certain types of disconnect where there is a
        // deliberate "soft" disconnection preceeding the "hard" socket read
        // fail or disconnect ack message.
        return;
    }

    std::cout << "client " << con << " left the lobby." << std::endl;

    const std::string alias = it->second;
    connections_.erase(it);
}

void socketio_server_handler::on_message(connection_ptr con, message_ptr msg) {
    if (msg->get_opcode() != websocketpp::frame::opcode::TEXT) {
        return;
    }

    std::cout << "message from client " << con << ": " << msg->get_payload() << std::endl;

    JSONNode n = libjson::parse(msg->get_payload());


    // check for special command messages
    if (msg->get_payload() == "/help") {
        // print command list
        con->send(encode_message("server","avaliable commands:<br />&nbsp;&nbsp;&nbsp;&nbsp;/help - show this help<br />&nbsp;&nbsp;&nbsp;&nbsp;/alias foo - set alias to foo",false));
        return;
    }

    if (msg->get_payload().substr(0,7) == "/alias ") {
        std::string response;
        std::string alias;

        if (msg->get_payload().size() == 7) {
            response = "You must enter an alias.";
            con->send(encode_message("server",response));
            return;
        } else {
            alias = msg->get_payload().substr(7);
        }

        response = connections_[con] + " is now known as "+alias;

        // store alias pre-escaped so we don't have to do this replacing every time this
        // user sends a message

        // escape JSON characters
        boost::algorithm::replace_all(alias,"\\","\\\\");
        boost::algorithm::replace_all(alias,"\"","\\\"");

        // escape HTML characters
        boost::algorithm::replace_all(alias,"&","&amp;");
        boost::algorithm::replace_all(alias,"<","&lt;");
        boost::algorithm::replace_all(alias,">","&gt;");

        connections_[con] = alias;

        con->send(encode_message("server","unrecognized command"));
        return;
    }

    // catch other slash commands
    if ((msg->get_payload())[0] == '/') {
        con->send(encode_message("server","unrecognized command"));
        return;
    }

}

std::string socketio_server_handler::get_con_id(connection_ptr con) {
    std::stringstream endpoint;
    //endpoint << con->get_endpoint();
    endpoint << con;
    return endpoint.str();
}

}
