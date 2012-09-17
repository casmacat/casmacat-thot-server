/**
 * @file IMtEngine.h
 * Interface for Machine Translation plug-ins
 *
 * @author Vicent Alabau
 */

#ifndef CASMACAT_IMTENGINE_HPP
#define CASMACAT_IMTENGINE_HPP

#include <string>
#include <vector>
#include <casmacat/plugin-utils.h>


namespace casmacat {

/**
 * @class IMtEngine
 *
 * @brief Interface for Machine Translation plug-in engines
 *
 * This class provides a simple interface for translation
 *
 * @author Vicent Alabau
 */

  class IMtEngine {
  public:
    IMtEngine() {};
    virtual ~IMtEngine() {};

    /**
     * initializes Mt Engine with main-like parameters
     */
    virtual int init(int argc, char *argv[]) { throw NotImplementedException(METHOD_DEFINITION); }

    /**
     * translates a sentence in a source language into a sentence in a target language
     *
     * This is a simplified version of the MT engine in `D5.1: Specification of casmacat workbench'
     * since this version does not take into account the optional parameters, as they are specific for
     * Moses. The original description is the following:
     *
     * translates sentence specified as `text'. If `align' switch is on, phrase alignment is returned.
     * If ’sg’ is on, search graph is returned. If ’topt’ is on, phrase options used are returned.
     * If ’report-all-factors’ is on, all factors are included in output. ’presence’ means that the
     * switch is on, if the category appears in the xml,value can be anything
     *
     * @param[in] source a sentence in the source language
     * @param[out] target a translation of source in the target language
     */
    virtual void translate(const std::string &source, 
                                 std::string &target
                          ) { throw NotImplementedException(METHOD_DEFINITION); }

    /**
     * updates translation models with source/target pair
     *
     * This is a simplified version of the MT engine in `D5.1: Specification of casmacat workbench'
     * since this version does not take into account the optional parameters, as they are specific for
     * Moses. The original description is the following:

     * updates a suffix array phrase table. If `bounded' switch is on,
     * seems to do nothing at the moment. If `updateORLM' is on, a suffix array language
     * model is also updated.
     *
     * @param[in] source a sentence in the source language
     * @param[in] target a sentence in the target language that is a valid translation of source
     */
    virtual void update(const std::string &source,
                        const std::string &target
                          ) { throw NotImplementedException(METHOD_DEFINITION); }

  private:
    // Following the rule of three copy and the assignment operator are disabled
    IMtEngine(const IMtEngine&);            // Disallow copy
    IMtEngine& operator=(const IMtEngine&); // Disallow assignment operator
  };

}

#endif // CASMACAT_IMTENGINE_HPP
