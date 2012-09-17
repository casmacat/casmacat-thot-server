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
 * translate.cpp
 *
 *  Created on: 21/06/2012
 *      Author: valabau
 */



#include <cstdlib>
#include <casmacat/compat.h>
#include <casmacat/utils.h>
#include <casmacat/IMtEngine.h>
#include <casmacat/Plugin.h>
#include <iostream>
#include <fstream>
#include <cassert>
#include <jsoncpp/json.h>

using namespace casmacat;
using namespace std;

int main(int argc, char* argv[]) {

    if (argc != 3) {
      cerr << "Usage: " << argv[0] << " config.js test\n";
      return EXIT_FAILURE;
    }

    Json::Value config(Json::objectValue);
//    config["mt"] = "nothing";
//    cerr << config.toStyledString() << "\n";

    {
      Json::Reader reader;
      ifstream config_f(argv[1]);
      bool is_ok = reader.parse(config_f, config);
      assert(is_ok);
    }

    cerr << config.toStyledString() << "\n";


    Plugin<IMtEngine> mt_plugin(config["mt"]);

    IMtEngine *mt = mt_plugin.create();
    cerr << "Plugin loaded\n";

    for (int i = 2; i < argc; i++) {
      ifstream file(argv[i]);
      string source, target;
      while(getline(file, source)) {
        cout << source << "|||";
        mt->translate(source, target);
        cout << target << "\n";
      }
    }

    return EXIT_SUCCESS;
}


