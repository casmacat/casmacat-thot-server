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
    virtual ~IMtEngine() {};

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
    virtual void translate(const std::vector<std::string> &source,
                                 std::vector<std::string> &target) = 0;

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
    virtual void update(const std::vector<std::string> &source,
                        const std::vector<std::string> &target) = 0;
  };

  class IMtFactory {
  public:
    virtual ~IMtFactory() {};
    /**
     * initialize the IMT Factory with main-like parameters
     */
    virtual int init(int argc, char *argv[]) = 0;
    virtual std::string getVersion() = 0;

    /**
     * create an instance of a confidence engine
     * @param[in] specialization_id returns a specialized version of the confidence engine,
     *            for instance, for user specific models
     */
    virtual IMtEngine *createEngine(const std::string &specialization_id = "") = 0;
  };

  }

#endif // CASMACAT_IMTENGINE_HPP
